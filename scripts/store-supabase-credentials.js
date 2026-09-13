// Input is JSON on stdin only. Never pass a token as a command-line argument.
const { storeSupabaseCredentials } = require('./lib/local-credentials')
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => {
  input += chunk
  if (input.length > 16384) { console.error('Entrada de credencial muito grande.'); process.exit(1) }
})
process.stdin.on('end', () => {
  try {
    const { accessToken, projectRef } = JSON.parse(input.replace(/^\uFEFF/, ""))
    const file = storeSupabaseCredentials(accessToken, projectRef)
    input = ''
    console.log(JSON.stringify({ stored: true, projectRef, path: file, protection: 'windows-dpapi-current-user' }))
  } catch {
    input = ''
    console.error('Nao foi possivel armazenar credenciais. Verifique o JSON de entrada e o usuario Windows.')
    process.exitCode = 1
  }
})
