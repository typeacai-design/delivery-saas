const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.local')
const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_SESSION_SECRET',
]
const migrations = ['037_motoboys_avaliacoes.sql', '038_complementos_qtd_max.sql', '039_cardapio_leitura_publica.sql', '040_sprints_5_6.sql', '041_cardapio_assets.sql']

const keys = new Set()
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)\s*=/)
    if (match) keys.add(match[1])
  }
}

let failed = false
for (const key of requiredEnv) {
  const present = keys.has(key) || Boolean(process.env[key])
  console.log(`${present ? 'OK' : 'FALTA'} env ${key}`)
  failed ||= !present
}
for (const migration of migrations) {
  const present = fs.existsSync(path.join(root, 'supabase', 'migrations', migration))
  console.log(`${present ? 'OK' : 'FALTA'} migration ${migration}`)
  failed ||= !present
}

console.log('INFO buckets esperados: logos, produtos, cardapio-assets, complementos')
console.log('INFO este diagnóstico é apenas local e não confirma o estado remoto')
process.exitCode = failed ? 1 : 0
