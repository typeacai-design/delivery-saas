-- Manual receivables never originate from orders and do not affect cash until received.
CREATE TABLE public.contas_receber (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 descricao text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 1 AND 500),
 valor numeric(12,2) NOT NULL CHECK (valor > 0),
 vencimento date NOT NULL,
 recebido boolean NOT NULL DEFAULT false,
 recebido_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contas_receber_tenant_due ON public.contas_receber(tenant_id,vencimento DESC,id DESC) WHERE NOT recebido;
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contas_receber FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contas_receber TO authenticated;
GRANT INSERT(id,tenant_id,descricao,valor,vencimento) ON public.contas_receber TO authenticated;
GRANT UPDATE(recebido) ON public.contas_receber TO authenticated;
GRANT ALL ON public.contas_receber TO service_role;
CREATE POLICY contas_receber_owner ON public.contas_receber TO authenticated
 USING (auth.uid() IS NOT NULL AND public.has_active_tenant_role(tenant_id,ARRAY['owner','manager']::text[]) AND EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.status='active' AND NOT coalesce(t.bloqueado,false)))
 WITH CHECK (auth.uid() IS NOT NULL AND public.has_active_tenant_role(tenant_id,ARRAY['owner','manager']::text[]) AND EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.status='active' AND NOT coalesce(t.bloqueado,false)));
CREATE FUNCTION public.conta_receber_caixa() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.recebido AND NOT NEW.recebido THEN RAISE EXCEPTION 'Recebimento já confirmado'; END IF;
 IF NOT OLD.recebido AND NEW.recebido THEN
   NEW.recebido_em := now();
   INSERT INTO public.movimentacoes_financeiras(tenant_id,tipo,categoria,descricao,valor,data,referencia_id)
   VALUES(NEW.tenant_id,'entrada','recebimento',NEW.descricao,NEW.valor,(now() AT TIME ZONE 'America/Sao_Paulo')::date,NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.conta_receber_caixa() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER conta_receber_caixa BEFORE UPDATE ON public.contas_receber FOR EACH ROW EXECUTE FUNCTION public.conta_receber_caixa();

CREATE OR REPLACE FUNCTION public.mobile_financeiro(p_tenant_id uuid, p_view text DEFAULT 'resumo', p_offset integer DEFAULT 0, p_limit integer DEFAULT 50, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_active_tenant_role(p_tenant_id, ARRAY['owner','manager']::text[]) OR NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active' AND NOT coalesce(bloqueado,false)) THEN
    RAISE EXCEPTION 'Acesso indisponível para esta loja' USING ERRCODE='42501';
  END IF;
  IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to) THEN
    RAISE EXCEPTION 'Paginação ou período inválido' USING ERRCODE='22023';
  END IF;
  IF p_view='resumo' THEN
    WITH orders AS MATERIALIZED (
    SELECT id,codigo,valor_total,pago,status,created_at,data_criacao FROM public.pedidos WHERE tenant_id=p_tenant_id
  ), transactions AS MATERIALIZED (
    SELECT id,tipo,descricao,valor,data,categoria,referencia_id FROM public.movimentacoes_financeiras WHERE tenant_id=p_tenant_id
  ), expenses AS MATERIALIZED (
    SELECT id,nome,valor,created_at FROM public.despesas WHERE tenant_id=p_tenant_id
  ), extra AS (
    SELECT o.* FROM orders o WHERE o.pago IS TRUE AND o.status<>'cancelado'
    AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.categoria IN ('pedido','venda')
      AND (t.referencia_id=o.id OR t.descricao IN (
        'Pedido #'||coalesce(nullif(o.codigo,''),left(o.id::text,8)),
        'Pedido '||coalesce(nullif(o.codigo,''),left(o.id::text,8)))))
  )
    SELECT jsonb_build_object(
      'received',coalesce((SELECT sum(valor_total) FROM orders WHERE pago IS TRUE AND status<>'cancelado' AND (p_from IS NULL OR data_criacao >= p_from::timestamp AT TIME ZONE 'America/Sao_Paulo') AND (p_to IS NULL OR data_criacao < (p_to+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')),0),
      'receivable',coalesce((SELECT sum(valor) FROM public.contas_receber WHERE tenant_id=p_tenant_id AND NOT recebido AND (p_from IS NULL OR vencimento>=p_from) AND (p_to IS NULL OR vencimento<=p_to)),0),
      'balance',coalesce((SELECT sum(CASE WHEN tipo='entrada' THEN valor ELSE -valor END) FROM transactions WHERE (p_from IS NULL OR data>=p_from) AND (p_to IS NULL OR data<=p_to)),0)
        +coalesce((SELECT sum(valor_total) FROM extra WHERE (p_from IS NULL OR (created_at AT TIME ZONE 'America/Sao_Paulo')::date>=p_from) AND (p_to IS NULL OR (created_at AT TIME ZONE 'America/Sao_Paulo')::date<=p_to)),0)-coalesce((SELECT sum(valor) FROM expenses WHERE (p_from IS NULL OR (created_at AT TIME ZONE 'America/Sao_Paulo')::date>=p_from) AND (p_to IS NULL OR (created_at AT TIME ZONE 'America/Sao_Paulo')::date<=p_to)),0)
    ) INTO result;
  ELSIF p_view='fluxo' THEN
    WITH orders AS MATERIALIZED (
    SELECT id,codigo,valor_total,pago,status,created_at,data_criacao FROM public.pedidos WHERE tenant_id=p_tenant_id
  ), transactions AS MATERIALIZED (
    SELECT id,tipo,descricao,valor,data,categoria,referencia_id FROM public.movimentacoes_financeiras WHERE tenant_id=p_tenant_id
  ), expenses AS MATERIALIZED (
    SELECT id,nome,valor,created_at FROM public.despesas WHERE tenant_id=p_tenant_id
  ), extra AS (
    SELECT o.* FROM orders o WHERE o.pago IS TRUE AND o.status<>'cancelado'
    AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.categoria IN ('pedido','venda')
      AND (t.referencia_id=o.id OR t.descricao IN (
        'Pedido #'||coalesce(nullif(o.codigo,''),left(o.id::text,8)),
        'Pedido '||coalesce(nullif(o.codigo,''),left(o.id::text,8)))))
  ), rows AS (
      SELECT 'mov:'||id::text AS id, descricao, data::text AS data, tipo, CASE WHEN tipo='entrada' THEN valor ELSE -valor END AS amount, data AS filter_day FROM transactions
      UNION ALL SELECT 'pedido:'||id::text,'Pedido #'||coalesce(nullif(codigo,''),left(id::text,8)),created_at::text,'entrada',valor_total,(created_at AT TIME ZONE 'America/Sao_Paulo')::date FROM extra
      UNION ALL SELECT 'despesa:'||id::text,nome,created_at::text,'saida',-valor,(created_at AT TIME ZONE 'America/Sao_Paulo')::date FROM expenses
    ), page AS (
      SELECT * FROM rows WHERE (p_from IS NULL OR filter_day>=p_from) AND (p_to IS NULL OR filter_day<=p_to)
      ORDER BY data DESC,id DESC LIMIT p_limit+1 OFFSET p_offset
    ), visible AS (SELECT * FROM page ORDER BY data DESC,id DESC LIMIT p_limit)
    SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY data DESC,id DESC) FROM visible v),'[]'::jsonb),
      'hasMore',(SELECT count(*)>p_limit FROM page)) INTO result;
  ELSIF p_view='receber' THEN
    WITH page AS (
      SELECT id,descricao,valor,vencimento::text AS data FROM public.contas_receber
      WHERE tenant_id=p_tenant_id AND NOT recebido AND (p_from IS NULL OR vencimento>=p_from) AND (p_to IS NULL OR vencimento<=p_to)
      ORDER BY vencimento DESC,id DESC LIMIT p_limit+1 OFFSET p_offset
    ), visible AS (SELECT * FROM page ORDER BY data DESC,id DESC LIMIT p_limit)
    SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY data DESC,id DESC) FROM visible v),'[]'::jsonb),'hasMore',(SELECT count(*)>p_limit FROM page)) INTO result;
  ELSIF p_view='despesas' THEN
    WITH page AS (
      SELECT id,nome,valor FROM public.despesas WHERE tenant_id=p_tenant_id AND (p_from IS NULL OR created_at>=p_from::timestamp AT TIME ZONE 'America/Sao_Paulo') AND (p_to IS NULL OR created_at<(p_to+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') ORDER BY created_at DESC,id DESC LIMIT p_limit+1 OFFSET p_offset
    ), visible AS (SELECT * FROM page LIMIT p_limit)
    SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM visible v),'[]'::jsonb),'hasMore',(SELECT count(*)>p_limit FROM page)) INTO result;
  ELSE RAISE EXCEPTION 'Consulta inválida' USING ERRCODE='22023';
  END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mobile_financeiro(uuid,text,integer,integer,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mobile_financeiro(uuid,text,integer,integer,date,date) TO authenticated;
