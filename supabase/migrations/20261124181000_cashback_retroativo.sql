-- Cashback retroativo (opcional, acionado pelo lojista em Marketing > Fidelidade).
-- Credita cashback para pedidos já pagos que ainda não geraram crédito, com a mesma regra do
-- trigger atualizar_metricas_cliente (pedido pago, não cancelado, cliente achado pelo telefone).
-- Idempotente: a unique key cashback_creditos(pedido_id) impede crédito duplicado, então rodar
-- de novo só credita pedidos que ficaram de fora. A validade conta a partir de agora.

CREATE OR REPLACE FUNCTION public.aplicar_cashback_retroativo(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_cfg jsonb;
  v_taxa numeric;
  v_dias integer;
  v_expira timestamptz;
  v_pedidos integer := 0;
  v_clientes integer := 0;
  v_total numeric := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios_loja u
    WHERE u.tenant_id = p_tenant_id AND u.user_id = auth.uid() AND u.ativo AND u.role IN ('owner', 'manager')
  ) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT t.config INTO v_cfg FROM public.tenants t WHERE t.id = p_tenant_id FOR UPDATE;
  IF COALESCE((v_cfg->>'cashback_ativo')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'cashback_inativo' USING ERRCODE = '22023';
  END IF;

  v_taxa := CASE WHEN v_cfg->>'cashback_tipo' = 'fixo_por_real'
    THEN COALESCE((v_cfg->>'cashback_valor_por_real')::numeric, 0)
    ELSE COALESCE((v_cfg->>'cashback_percent')::numeric, 0) / 100 END;
  IF v_taxa <= 0 OR v_taxa > 1 THEN
    RAISE EXCEPTION 'cashback_regra_invalida' USING ERRCODE = '22023';
  END IF;

  v_dias := NULLIF(v_cfg->>'cashback_validade_dias', '')::integer;
  v_expira := CASE WHEN v_dias IS NULL THEN NULL ELSE pg_catalog.now() + pg_catalog.make_interval(days => GREATEST(1, v_dias)) END;

  WITH elegiveis AS (
    SELECT p.id AS pedido_id,
      round(GREATEST(0, COALESCE(p.valor_total, 0)) * v_taxa, 2) AS valor,
      (SELECT c.id FROM public.clientes c
        WHERE c.tenant_id = p.tenant_id
          AND c.telefone = pg_catalog.regexp_replace(p.cliente_whatsapp, '\D', '', 'g')
        ORDER BY c.created_at ASC LIMIT 1) AS cliente_id
    FROM public.pedidos p
    WHERE p.tenant_id = p_tenant_id
      AND p.pago IS TRUE
      AND p.status <> 'cancelado'
      AND p.deleted_at IS NULL
      AND COALESCE(p.cliente_whatsapp, '') <> ''
      AND NOT EXISTS (SELECT 1 FROM public.cashback_creditos cc WHERE cc.pedido_id = p.id)
  ), inseridos AS (
    INSERT INTO public.cashback_creditos (tenant_id, cliente_id, pedido_id, valor_original, valor_restante, expira_em)
    SELECT p_tenant_id, e.cliente_id, e.pedido_id, e.valor, e.valor, v_expira
    FROM elegiveis e
    WHERE e.cliente_id IS NOT NULL AND e.valor > 0
    ON CONFLICT (pedido_id) DO NOTHING
    RETURNING cliente_id, valor_original
  ), por_cliente AS (
    SELECT i.cliente_id, sum(i.valor_original) AS soma, count(*) AS qtd FROM inseridos i GROUP BY i.cliente_id
  ), atualizados AS (
    UPDATE public.clientes c SET saldo_cashback = COALESCE(c.saldo_cashback, 0) + pc.soma
    FROM por_cliente pc
    WHERE c.id = pc.cliente_id AND c.tenant_id = p_tenant_id
    RETURNING pc.soma, pc.qtd
  )
  SELECT COALESCE(sum(a.qtd), 0)::integer, count(*)::integer, COALESCE(sum(a.soma), 0)
  INTO v_pedidos, v_clientes, v_total
  FROM atualizados a;

  RETURN jsonb_build_object('pedidos', v_pedidos, 'clientes', v_clientes, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_cashback_retroativo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_cashback_retroativo(uuid) TO authenticated;
