const fs = require('node:fs')

const { query } = require('./lib/supabase-management')

async function main() {
  if (process.argv.includes('--inspect-policies')) {
    const policies = await query(`select tablename,policyname,roles,cmd,qual from pg_policies where schemaname='public' and tablename in ('pedidos','pedido_itens','enderecos_entrega') order by tablename,policyname`)
    console.log(JSON.stringify(policies))
    return
  }
  const [preflight] = await query(`select
    (select count(*) from (select lower(slug) from public.tenants group by 1 having count(*) > 1) d) as duplicate_slugs,
    (select count(*) from (select tenant_id,lower(trim(bairro)) from public.enderecos_entrega group by 1,2 having count(*) > 1) d) as duplicate_areas,
    (select count(*) from public.tenants t where
      ((to_jsonb(t)->>'latitude') is null) <> ((to_jsonb(t)->>'longitude') is null)
      or nullif(to_jsonb(t)->>'latitude','')::numeric not between -90 and 90
      or nullif(to_jsonb(t)->>'longitude','')::numeric not between -180 and 180) as invalid_coordinates,
    (select count(*) from public.enderecos_entrega where taxa is null or taxa < 0 or taxa > 100000) as invalid_fees
  `)
  if (Object.values(preflight).some((value) => Number(value) > 0)) {
    throw new Error(`Preflight bloqueado: ${JSON.stringify(preflight)}`)
  }

  for (const version of ['044', '045', '046']) {
    const file = fs.readdirSync('supabase/migrations').find((name) => name.startsWith(`${version}_`))
    if (!file) throw new Error(`Migration ${version} nao encontrada`)
    await query(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'))
    console.log(`OK migration ${version}`)
  }

  const [state] = await query(`select
    to_regprocedure('public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb)') is not null as pedido_rpc,
    to_regprocedure('public.aceitar_convite_loja(text)') is not null as convite_rpc,
    to_regclass('public.convites_loja') is not null as convites,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='latitude') as geo,
    not exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name in ('pedidos','pedido_itens') and grantee='anon') as anon_orders_revoked,
    not exists(select 1 from pg_policies where schemaname='public' and tablename in ('pedidos','pedido_itens') and policyname like 'Membros gerenciam%') as broad_policies_removed,
    exists(select 1 from pg_policies where schemaname='public' and tablename='enderecos_entrega' and policyname in ('Bairros ativos publicos','Bairros ativos públicos') and roles='{anon}' and cmd='SELECT' and qual like '%ativo = true%') as active_areas_policy
  `)
  if (!Object.values(state).every(Boolean)) throw new Error(`Verificacao final falhou: ${JSON.stringify(state)}`)
  console.log('OK migrations 044-046 aplicadas e verificadas')
}

main().catch((error) => { console.error(error.message); process.exit(1) })
