const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

function credentialPath(env = process.env) {
  let project = env.WE_DELIVERY_CREDENTIALS_PROJECT
  if (project && !path.isAbsolute(project)) throw new Error('WE_DELIVERY_CREDENTIALS_PROJECT deve ser um caminho absoluto.')
  if (!project) {
    const sourceRoot = path.resolve(__dirname, '../..')
    const git = spawnSync('git', ['-C', sourceRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', windowsHide: true,
    })
    project = git.status === 0 && git.stdout.trim()
      ? path.dirname(git.stdout.trim()) : sourceRoot
  }
  return path.join(project, '.credentials', 'supabase.json')
}

function legacyCredentialPath(env = process.env) {
  return env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'WeDelivery', 'credentials', 'supabase.json') : undefined
}

function protectToken(value, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('Credenciais DPAPI exigem Windows. Use variaveis de ambiente neste sistema.')
  const command = decrypt
    ? "$ErrorActionPreference='Stop'; $s=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }"
    : "$ErrorActionPreference='Stop'; $s=ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force; [Console]::Out.Write((ConvertFrom-SecureString $s))"
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    input: value, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024,
  })
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error('Nao foi possivel acessar a credencial DPAPI deste usuario Windows.')
  }
  return result.stdout.trim()
}

function storeSupabaseCredentials(accessToken, projectRef, env = process.env) {
  if (typeof accessToken !== 'string' || !/^sbp_[A-Za-z0-9_-]{20,}$/.test(accessToken.trim())) throw new Error('Token pessoal Supabase invalido.')
  if (typeof projectRef !== 'string' || !/^[a-z0-9]{20}$/.test(projectRef)) throw new Error('Project ref invalido.')
  const file = credentialPath(env)
  const document = {
    version: 1, protection: 'windows-dpapi-current-user', projectRef,
    tokenCiphertext: protectToken(accessToken.trim()),
  }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const temporary = file + '.tmp-' + process.pid
  try {
    fs.writeFileSync(temporary, JSON.stringify(document, null, 2), { mode: 0o600, flag: 'wx' })
    fs.renameSync(temporary, file)
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  return file
}

function localSupabaseValue(name, env = process.env) {
  if (name !== 'SUPABASE_ACCESS_TOKEN' && name !== 'SUPABASE_PROJECT_REF') return undefined
  if (process.platform !== 'win32') return undefined
  const file = [credentialPath(env), legacyCredentialPath(env)].find(candidate => candidate && fs.existsSync(candidate))
  if (!file) return undefined
  let stored
  try { stored = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { throw new Error('Arquivo local de credenciais Supabase invalido.') }
  if (stored.version !== 1 || stored.protection !== 'windows-dpapi-current-user' || !/^[a-z0-9]{20}$/.test(stored.projectRef || '')) {
    throw new Error('Formato local de credenciais Supabase invalido.')
  }
  if (name === 'SUPABASE_PROJECT_REF') return stored.projectRef
  if (typeof stored.tokenCiphertext !== 'string') throw new Error('Credencial Supabase local ausente.')
  return protectToken(stored.tokenCiphertext, true)
}

module.exports = { credentialPath, protectToken, storeSupabaseCredentials, localSupabaseValue }
