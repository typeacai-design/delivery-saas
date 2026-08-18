const fs = require('node:fs')

const { query } = require('./lib/supabase-management')

async function main() {
  const couponState = await query(`select to_regclass('public.cupons') is not null as present`)
  if (!couponState[0].present) {
    await query(`create table public.cupons (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
      codigo text not null, tipo text not null check (tipo in ('percentual','valor_fixo')), valor decimal(10,2) not null,
      valor_minimo_pedido decimal(10,2) default 0, validade date not null, max_usos integer,
      usos_atuais integer default 0, ativo boolean default true, created_at timestamptz default now(), unique(tenant_id,codigo)
    ); alter table public.cupons enable row level security;
    create policy "Cupons do proprio tenant" on public.cupons for all using (tenant_id=auth.uid()) with check (tenant_id=auth.uid());`)
    console.log('OK dependência cupons criada')
  }
  const logoState = await query(`select exists(select 1 from storage.buckets where id='logos') as present`)
  if (!logoState[0].present) {
    await query(`insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('logos','logos',true,5242880,array['image/jpeg','image/png','image/webp']);
      create policy "Logos publicos" on storage.objects for select to public using(bucket_id='logos');
      create policy "Lojista gerencia logo" on storage.objects for all to authenticated
      using(bucket_id='logos' and auth.uid()::text=(storage.foldername(name))[1])
      with check(bucket_id='logos' and auth.uid()::text=(storage.foldername(name))[1]);`)
    console.log('OK bucket logos criado')
  }
  const checks = await query(`select
    to_regclass('public.motoboys') is not null and to_regclass('public.avaliacoes') is not null as m037,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='complementos' and column_name='qtd_max') as m038,
    exists(select 1 from pg_policies where schemaname='public' and policyname='Cardapio publico ve produtos ativos') as m039,
    to_regclass('public.embaixadores') is not null and to_regclass('public.campanhas_sorteio') is not null as m040,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='banner_url')
      and exists(select 1 from storage.buckets where id='cardapio-assets') as m041
  `)
  const state = checks[0]
  for (const number of ['037', '038', '039', '040', '041']) {
    if (state[`m${number}`]) { console.log(`OK migration ${number} já aplicada`); continue }
    const file = fs.readdirSync('supabase/migrations').find((name) => name.startsWith(`${number}_`))
    if (!file) throw new Error(`Migration ${number} não encontrada`)
    await query(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'))
    console.log(`OK migration ${number}`)
  }
  const result = await query(`
    select
      to_regclass('public.motoboys') is not null as motoboys,
      to_regclass('public.avaliacoes') is not null as avaliacoes,
      to_regclass('public.embaixadores') is not null as embaixadores,
      to_regclass('public.campanhas_sorteio') is not null as campanhas_sorteio,
      exists(select 1 from storage.buckets where id='logos') as bucket_logos,
      exists(select 1 from storage.buckets where id='produtos') as bucket_produtos,
      exists(select 1 from storage.buckets where id='cardapio-assets') as bucket_cardapio_assets,
      exists(select 1 from storage.buckets where id='complementos') as bucket_complementos
  `)
  console.log(JSON.stringify(result))
}

main().catch((error) => { console.error(error.message); process.exit(1) })
