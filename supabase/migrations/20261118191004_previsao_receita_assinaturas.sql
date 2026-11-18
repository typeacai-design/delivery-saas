CREATE FUNCTION public.previsao_receita_assinaturas(p_competencia date)
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT coalesce(sum(f.valor_centavos), 0)::bigint
  FROM public.faturamento_assinatura(p_competencia) f
  JOIN public.tenants t ON t.id = f.tenant_id
  WHERE (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date + 30
    <= (p_competencia + interval '1 month 9 days')::date
$$;

REVOKE ALL ON FUNCTION public.previsao_receita_assinaturas(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.previsao_receita_assinaturas(date) TO service_role;
