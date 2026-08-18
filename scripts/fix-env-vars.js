// Regrava variáveis da Vercel sem BOM. Todos os valores vêm do ambiente.
const https = require('https')

const VERCEL_PATHS = [
  `${process.env.APPDATA}\\xdg.data\\com.vercel.cli\\auth.json`,
  `${process.env.APPDATA}\\com.vercel.cli\\Data\\auth.json`,
]

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

function getVercelToken() {
  for (const path of VERCEL_PATHS) {
    try { return require(path).token } catch {}
  }
  return null
}

function api(token, projectId, method, path, body) {
  const data = body ? JSON.stringify(body) : null
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.vercel.com', port: 443, path, method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
      },
    }, response => {
      let result = ''
      response.on('data', chunk => { result += chunk })
      response.on('end', () => {
        try { resolve(JSON.parse(result)) } catch { resolve(result) }
      })
    })
    request.on('error', reject)
    if (data) request.write(data)
    request.end()
  })
}

async function setEnvVar(token, projectId, key, value, sensitive, targets = ['production', 'development', 'preview']) {
  const cleanValue = value.replace(/^\uFEFF/, '').trim()
  const list = await api(token, projectId, 'GET', `/v9/projects/${projectId}/env`)
  if (list.envs) {
    for (const env of list.envs.filter(item => item.key === key)) {
      await api(token, projectId, 'DELETE', `/v9/projects/${projectId}/env/${env.id}`)
      console.log(`  ${key}: configuração antiga removida`)
    }
  }
  return api(token, projectId, 'POST', `/v10/projects/${projectId}/env`, {
    key, value: cleanValue, type: sensitive ? 'sensitive' : 'encrypted', target: targets,
  })
}

async function main() {
  const vercelToken = getVercelToken()
  if (!vercelToken) throw new Error('Token da Vercel não encontrado no login local da CLI')
  const projectId = required('VERCEL_PROJECT_ID')
  const supabaseToken = required('SUPABASE_ACCESS_TOKEN')
  const projectRef = required('SUPABASE_PROJECT_REF')
  const adminEmail = required('ADMIN_EMAIL')
  const adminPassword = required('ADMIN_PASSWORD')
  const adminSessionSecret = required('ADMIN_SESSION_SECRET')

  const apiKeys = await new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/api-keys`,
      headers: { Authorization: `Bearer ${supabaseToken}` },
    }, response => {
      let result = ''
      response.on('data', chunk => { result += chunk })
      response.on('end', () => resolve(JSON.parse(result)))
    })
    request.on('error', reject)
    request.end()
  })

  const anon = apiKeys.find(key => key.name === 'anon')?.api_key
  const serviceKey = apiKeys.find(key => key.name === 'service_role')?.api_key
  if (!anon || !serviceKey) throw new Error('Chaves esperadas não retornadas pelo Supabase')

  console.log('Regravando variáveis sem BOM (valores não serão exibidos)...')
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    ADMIN_SESSION_SECRET: adminSessionSecret,
  }
  for (const [key, value] of Object.entries(values)) {
    const sensitive = ['SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET'].includes(key)
    await setEnvVar(vercelToken, projectId, key, value, sensitive)
    console.log(`  ${key}: atualizada`)
  }
  console.log('Variáveis atualizadas sem exibir valores')
}

main().catch(error => {
  console.error('Falha ao atualizar variáveis:', error.message)
  process.exit(1)
})
