const fs = require('node:fs')

const { query } = require('./lib/supabase-management')


async function main() {
  if (process.argv.includes('--inspect-pedidos')) {
    const columns = await query(`select column_name from information_schema.columns where table_schema='public' and table_name='pedidos' and column_name in ('created_at','data_pedido','criado_em','data_criacao') order by column_name`)
    console.log(columns.map(({ column_name }) => column_name).join(','))
    return
  }
  const file = fs.readdirSync('supabase/migrations').find((name) => name.startsWith('043_'))
  if (!file) throw new Error('Migration 043 nao encontrada')
  await query(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'))

  const [state] = await query(`select
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='cpf') as cpf,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='acesso_token_hash') as cliente_hash,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='pedidos' and column_name='cliente_acesso_token_hash') as pedido_hash,
    to_regclass('public.api_rate_limits') is not null as rate_limits,
    to_regprocedure('public.consume_api_rate_limit(text,integer,integer)') is not null as rate_limit_rpc
  `)
  if (!Object.values(state).every(Boolean)) throw new Error('Verificacao da migration 043 falhou')
  console.log('OK migration 043 aplicada e verificada')
}

main().catch((error) => { console.error(error.message); process.exit(1) })
