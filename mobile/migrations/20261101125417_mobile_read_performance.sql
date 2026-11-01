-- Additive read-only RPCs. No table grants, data writes, RLS changes or website changes.
-- Retains the existing app's financeSummary predicates, including historical expense handling.
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
    SELECT id,codigo,valor_total,pago,status,created_at FROM public.pedidos WHERE tenant_id=p_tenant_id
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
      'received',coalesce((SELECT sum(valor_total) FROM orders WHERE pago IS TRUE AND status<>'cancelado'),0),
      'receivable',coalesce((SELECT sum(valor_total) FROM orders WHERE pago IS NOT TRUE AND status<>'cancelado'),0),
      'balance',coalesce((SELECT sum(CASE WHEN tipo='entrada' THEN valor ELSE -valor END) FROM transactions),0)
        +coalesce((SELECT sum(valor_total) FROM extra),0)-coalesce((SELECT sum(valor) FROM expenses),0)
    ) INTO result;
  ELSIF p_view='fluxo' THEN
    WITH orders AS MATERIALIZED (
    SELECT id,codigo,valor_total,pago,status,created_at FROM public.pedidos WHERE tenant_id=p_tenant_id
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
      SELECT id,codigo,valor_total FROM public.pedidos WHERE tenant_id=p_tenant_id AND pago IS NOT TRUE AND status<>'cancelado'
      ORDER BY created_at DESC,id DESC LIMIT p_limit+1 OFFSET p_offset
    ), visible AS (SELECT * FROM page LIMIT p_limit)
    SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM visible v),'[]'::jsonb),'hasMore',(SELECT count(*)>p_limit FROM page)) INTO result;
  ELSIF p_view='despesas' THEN
    WITH page AS (
      SELECT id,nome,valor FROM public.despesas WHERE tenant_id=p_tenant_id ORDER BY created_at DESC,id DESC LIMIT p_limit+1 OFFSET p_offset
    ), visible AS (SELECT * FROM page LIMIT p_limit)
    SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM visible v),'[]'::jsonb),'hasMore',(SELECT count(*)>p_limit FROM page)) INTO result;
  ELSE RAISE EXCEPTION 'Consulta inválida' USING ERRCODE='22023';
  END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mobile_financeiro(uuid,text,integer,integer,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mobile_financeiro(uuid,text,integer,integer,date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.mobile_inicio(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; day_start timestamptz := (date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');
month_start timestamptz := (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_active_tenant_role(p_tenant_id, ARRAY['owner','manager']::text[]) OR NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active' AND NOT coalesce(bloqueado,false)) THEN
    RAISE EXCEPTION 'Acesso indisponível para esta loja' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'totalToday',coalesce(sum(valor_total) FILTER (WHERE pago IS TRUE AND data_criacao>=day_start AND data_criacao<day_start+interval '1 day'),0),
    'paidToday',count(*) FILTER (WHERE pago IS TRUE AND data_criacao>=day_start AND data_criacao<day_start+interval '1 day'),
    'totalMonth',coalesce(sum(valor_total) FILTER (WHERE pago IS TRUE),0),
    'paidMonth',count(*) FILTER (WHERE pago IS TRUE),
    'fresh',count(*) FILTER (WHERE status='novo' AND data_criacao>=day_start AND data_criacao<day_start+interval '1 day'),
    'ongoing',count(*) FILTER (WHERE status IN ('novo','preparando','pronto','saiu') AND data_criacao>=day_start AND data_criacao<day_start+interval '1 day'),
    'profile',(SELECT jsonb_build_object('config',config,'slug',slug) FROM public.tenants WHERE id=p_tenant_id)
  ) INTO result FROM public.pedidos WHERE tenant_id=p_tenant_id AND deleted_at IS NULL AND data_criacao>=month_start AND status<>'cancelado';
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.mobile_inicio(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mobile_inicio(uuid) TO authenticated;
