const fs = require('fs')

const { query } = require('./lib/supabase-management')

function readEnv() {
  return Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')]
      })
  )
}

async function publicCount(table, tenantId, env) {
  const url = new URL(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`)
  url.searchParams.set('select', 'id')
  url.searchParams.set('tenant_id', `eq.${tenantId}`)
  const response = await fetch(url, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`PostgREST ${table} ${response.status}: ${body}`)
  return response.headers.get('content-range')
}

async function run() {
  await query(fs.readFileSync('supabase/migrations/039_cardapio_leitura_publica.sql', 'utf8'))
  const env = readEnv()
  const tenantId = '1396a259-0217-4d26-b819-fd8a15d18dea'
  const categorias = await publicCount('categorias', tenantId, env)
  const produtos = await publicCount('produtos', tenantId, env)
  console.log(JSON.stringify({ categorias, produtos }))
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
