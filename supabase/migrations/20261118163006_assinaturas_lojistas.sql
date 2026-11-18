CREATE TABLE public.faturas_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  loja_nome text NOT NULL,
  competencia date NOT NULL CHECK (extract(day FROM competencia) = 1),
  faturamento_centavos bigint NOT NULL CHECK (faturamento_centavos > 0),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  vencimento date NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  checkout_reservado_em timestamptz,
  mp_preferencia_id text UNIQUE,
  checkout_url text,
  mp_pagamento_id text UNIQUE,
  pago_em timestamptz,
  UNIQUE (tenant_id, competencia),
  CHECK ((checkout_url IS NULL) = (mp_preferencia_id IS NULL))
);

ALTER TABLE public.faturas_assinatura ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.faturas_assinatura FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.faturas_assinatura TO service_role;

CREATE INDEX faturas_assinatura_abertas
  ON public.faturas_assinatura (tenant_id, vencimento)
  WHERE checkout_url IS NOT NULL AND pago_em IS NULL;

CREATE FUNCTION public.faturamento_assinatura(p_competencia date)
RETURNS TABLE (tenant_id uuid, faturamento_centavos bigint, valor_centavos bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT t.id, f.total, (((f.total + 499999) / 500000) * 5000)::bigint
  FROM public.tenants t
  CROSS JOIN LATERAL (
    SELECT greatest(0, coalesce(sum(round(p.valor_total * 100)), 0))::bigint AS total
    FROM public.pedidos p
    WHERE p.tenant_id = t.id
      AND p.data_criacao >= (p_competencia::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND p.data_criacao < ((p_competencia + interval '1 month') AT TIME ZONE 'America/Sao_Paulo')
      AND p.deleted_at IS NULL
      AND p.status <> 'cancelado'
      AND (p.pago IS TRUE OR (p.status = 'entregue' AND p.forma_pagamento = ARRAY['dinheiro']::text[]))
  ) f
  WHERE t.status = 'active'
$$;

CREATE FUNCTION public.gerar_faturas_assinatura(p_competencia date)
RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  INSERT INTO public.faturas_assinatura (tenant_id, loja_nome, competencia, faturamento_centavos, valor_centavos, vencimento)
  SELECT f.tenant_id, t.nome, p_competencia, f.faturamento_centavos, f.valor_centavos,
    (p_competencia + interval '1 month 9 days')::date
  FROM public.faturamento_assinatura(p_competencia) f
  JOIN public.tenants t ON t.id = f.tenant_id
  WHERE f.valor_centavos > 0
    AND (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date + 30 <= (p_competencia + interval '1 month 9 days')::date
  ON CONFLICT (tenant_id, competencia) DO NOTHING
$$;

REVOKE ALL ON FUNCTION public.faturamento_assinatura(date), public.gerar_faturas_assinatura(date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.faturamento_assinatura(date), public.gerar_faturas_assinatura(date) TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE FUNCTION private.impedir_pedido_com_assinatura_vencida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.faturas_assinatura f
    WHERE f.tenant_id = NEW.tenant_id AND f.pago_em IS NULL AND f.checkout_url IS NOT NULL
      AND f.vencimento < (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
  ) THEN
    RAISE EXCEPTION 'assinatura_vencida' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.impedir_pedido_com_assinatura_vencida() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assinatura_impede_novos_pedidos
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION private.impedir_pedido_com_assinatura_vencida();

CREATE TABLE public.pagamentos_fatura_assinatura (
  mp_pagamento_id text PRIMARY KEY,
  fatura_id uuid NOT NULL REFERENCES public.faturas_assinatura(id) ON DELETE CASCADE,
  atualizado_em timestamptz NOT NULL,
  aprovado_em timestamptz
);
ALTER TABLE public.pagamentos_fatura_assinatura ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pagamentos_fatura_assinatura FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pagamentos_fatura_assinatura TO service_role;
CREATE INDEX pagamentos_fatura_assinatura_por_fatura ON public.pagamentos_fatura_assinatura (fatura_id);

CREATE FUNCTION public.conciliar_fatura_assinatura(
  p_fatura_id uuid, p_pagamento_id text, p_valor_centavos bigint, p_atualizado_em timestamptz, p_aprovado_em timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.faturas_assinatura
  WHERE id = p_fatura_id AND valor_centavos = p_valor_centavos AND checkout_url IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.pagamentos_fatura_assinatura AS anterior (mp_pagamento_id, fatura_id, atualizado_em, aprovado_em)
  VALUES (p_pagamento_id, p_fatura_id, p_atualizado_em, p_aprovado_em)
  ON CONFLICT (mp_pagamento_id) DO UPDATE SET atualizado_em = excluded.atualizado_em, aprovado_em = excluded.aprovado_em
  WHERE anterior.fatura_id = excluded.fatura_id AND anterior.atualizado_em < excluded.atualizado_em;

  UPDATE public.faturas_assinatura SET
    (mp_pagamento_id, pago_em) = (
      SELECT mp_pagamento_id, aprovado_em FROM public.pagamentos_fatura_assinatura
      WHERE fatura_id = p_fatura_id AND aprovado_em IS NOT NULL ORDER BY aprovado_em, mp_pagamento_id LIMIT 1
    )
  WHERE id = p_fatura_id;
END;
$$;
REVOKE ALL ON FUNCTION public.conciliar_fatura_assinatura(uuid,text,bigint,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conciliar_fatura_assinatura(uuid,text,bigint,timestamptz,timestamptz) TO service_role;
