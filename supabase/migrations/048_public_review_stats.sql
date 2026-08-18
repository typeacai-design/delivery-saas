create or replace function public.get_public_review_stats(p_tenant_id uuid)
returns table(total bigint, media numeric)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::bigint, coalesce(round(avg(nota)::numeric, 1), 0)
  from public.avaliacoes
  where tenant_id = p_tenant_id and aprovado = true;
$$;

revoke all on function public.get_public_review_stats(uuid) from public, anon, authenticated;
grant execute on function public.get_public_review_stats(uuid) to service_role;
