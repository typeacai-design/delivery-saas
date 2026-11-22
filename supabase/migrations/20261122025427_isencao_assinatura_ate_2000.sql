-- Isenção permanente para faturamento mensal de até R$ 2.000.
-- Preserva as faixas existentes acima desse limite, as regras de apuração e os acessos.
CREATE OR REPLACE FUNCTION public.faturamento_assinatura(p_competencia date)
RETURNS TABLE (tenant_id uuid, faturamento_centavos bigint, valor_centavos bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT t.id, f.total,
    CASE WHEN f.total <= 200000 THEN 0::bigint
         ELSE (((f.total + 499999) / 500000) * 5000)::bigint
    END
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

REVOKE ALL ON FUNCTION public.faturamento_assinatura(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.faturamento_assinatura(date) TO service_role;
