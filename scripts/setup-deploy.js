// Valida as credenciais necessárias para preparar um deploy.
// Não grava nem imprime valores sensíveis.
const https = require('https')
const { required } = require('./lib/supabase-management')

async function verifySupabaseAccess() {
  const accessToken = required('SUPABASE_ACCESS_TOKEN')
  const projectRef = required('SUPABASE_PROJECT_REF')
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/api-keys`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, response => {
      let body = ''
      response.on('data', chunk => { body += chunk })
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`Supabase recusou a solicitação (HTTP ${response.statusCode})`))
        const keys = JSON.parse(body)
        if (!keys.some(key => key.name === 'service_role')) return reject(new Error('Chave service_role não encontrada'))
        resolve()
      })
    })
    request.on('error', reject)
    request.end()
  })
}

verifySupabaseAccess()
  .then(() => console.log('Credenciais de deploy validadas sem exibir ou gravar segredos'))
  .catch(error => { console.error(error.message); process.exit(1) })
