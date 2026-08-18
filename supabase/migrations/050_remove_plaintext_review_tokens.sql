drop trigger if exists trg_sync_avaliacao_token_security on public.pedidos;
drop function if exists public.sync_avaliacao_token_security();
drop function if exists public.hash_review_token(text);

update public.pedidos set avaliacao_token = null where avaliacao_token is not null;
alter table public.pedidos drop column if exists avaliacao_token;
alter table public.pedidos alter column avaliacao_token_expires_at set default (now() + interval '90 days');

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='pedidos' and column_name='avaliacao_token') then
    raise exception 'Migration 050 failed to remove plaintext review tokens';
  end if;
end
$$;
notify pgrst, 'reload schema';