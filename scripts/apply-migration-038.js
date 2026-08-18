const fs = require('fs')

const { query } = require('./lib/supabase-management')


async function run() {
  const migration = fs.readFileSync(
    'supabase/migrations/038_complementos_qtd_max.sql',
    'utf8'
  )
  await query(migration)

  const result = await query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complementos'
      AND column_name = 'qtd_max'
  `)
  console.log(result)

  // Confirma tambem o schema cache do PostgREST, origem do erro no formulario.
  const env = Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')]
      })
  )
  const restResponse = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/complementos?select=qtd_max&limit=1`,
    {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!restResponse.ok) {
    throw new Error(`PostgREST ${restResponse.status}: ${await restResponse.text()}`)
  }
  console.log(`PostgREST schema cache: OK (${restResponse.status})`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
