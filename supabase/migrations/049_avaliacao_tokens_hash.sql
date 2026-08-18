create schema if not exists extensions;
do $$
begin
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pgcrypto') then
    create extension pgcrypto with schema extensions;
  end if;
end
$$;

create or replace function public.hash_review_token(p_token text)
returns text
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  digest_schema name;
  result text;
begin
  select n.nspname into digest_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  if digest_schema is null then raise exception 'pgcrypto extension is required'; end if;
  execute format('select pg_catalog.encode(%I.digest($1, ''sha256''), ''hex'')', digest_schema)
    into result using p_token;
  return result;
end
$$;
revoke all on function public.hash_review_token(text) from public, anon, authenticated;
grant execute on function public.hash_review_token(text) to service_role;

alter table public.pedidos add column if not exists avaliacao_token_hash text;
alter table public.pedidos add column if not exists avaliacao_token_expires_at timestamptz;
alter table public.pedidos add column if not exists avaliacao_token_used_at timestamptz;

update public.pedidos
set avaliacao_token_hash = public.hash_review_token(avaliacao_token::text),
    avaliacao_token_expires_at = greatest(coalesce(created_at, now()) + interval '365 days', now() + interval '90 days')
where avaliacao_token is not null
  and (avaliacao_token_hash is null or avaliacao_token_expires_at is null);

create unique index if not exists idx_pedidos_avaliacao_token_hash on public.pedidos(avaliacao_token_hash) where avaliacao_token_hash is not null;

create or replace function public.sync_avaliacao_token_security()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.avaliacao_token is not null and (new.avaliacao_token_hash is null or new.avaliacao_token is distinct from old.avaliacao_token) then
    new.avaliacao_token_hash := public.hash_review_token(new.avaliacao_token::text);
  end if;
  if new.avaliacao_token is not null and new.avaliacao_token_expires_at is null then new.avaliacao_token_expires_at := now() + interval '90 days'; end if;
  return new;
end
$$;
drop trigger if exists trg_sync_avaliacao_token_security on public.pedidos;
create trigger trg_sync_avaliacao_token_security before insert or update of avaliacao_token on public.pedidos for each row execute function public.sync_avaliacao_token_security();
revoke all on function public.sync_avaliacao_token_security() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.consume_api_rate_limit(text,integer,integer)') is null then raise exception 'Migration 049 requires consume_api_rate_limit(text,integer,integer)'; end if;
  if exists (select 1 from public.pedidos where avaliacao_token is not null and (avaliacao_token_hash is null or avaliacao_token_expires_at is null)) then raise exception 'Migration 049 could not backfill all review tokens'; end if;
end
$$;
notify pgrst, 'reload schema';