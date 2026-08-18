function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

async function executeSql(sql) {
  const accessToken = required('SUPABASE_ACCESS_TOKEN')
  const projectRef = required('SUPABASE_PROJECT_REF')
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!response.ok) throw new Error(`Migração recusada pela API (HTTP ${response.status})`)
  console.log('Migração aplicada com sucesso')
}

async function query(sql) {
  const accessToken = required('SUPABASE_ACCESS_TOKEN')
  const projectRef = required('SUPABASE_PROJECT_REF')
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!response.ok) throw new Error(`Supabase respondeu HTTP ${response.status}`)
  return response.json()
}

module.exports = { executeSql, query, required }
