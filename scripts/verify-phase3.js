const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')
const explicitTargets = [
  'src/app/dashboard-view.tsx',
  'src/app/(dashboard)/pedidos/page.tsx',
  'src/app/(dashboard)/pedidos/novo/page.tsx',
  'src/app/(dashboard)/relatorios/page.tsx',
  'src/app/(dashboard)/clientes/page.tsx',
  'src/app/(dashboard)/motoboys/page.tsx',
  'src/app/api/analytics/route.ts',
  'src/app/api/upload-cardapio-asset/route.ts',
  'src/app/(dashboard)/layout.tsx',
  'src/components/sidebar-nav.tsx',
  'src/app/api/auth/login/route.ts',
]
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(file)
    return /\.(ts|tsx)$/.test(entry.name) ? [path.relative(root, file).replace(/\\/g, '/')] : []
  })
}
const runtimeTargets = walk(path.join(root, 'src')).filter((file) =>
  file.startsWith('src/app/(dashboard)/') || file.startsWith('src/app/api/') || file.startsWith('src/components/admin/')
)
const targets = [...new Set([...explicitTargets, ...runtimeTargets])]
const forbidden = [
  [/\.eq\(['"]tenant_id['"],\s*user(?:\.user)?\.id\)/, 'consulta tenant_id=user.id'],
  [/tenant_id:\s*user(?:\.user)?\.id/, 'gravacao tenant_id=user.id'],
  [/const\s+tid\s*=\s*user(?:\.user)?\.id/, 'alias tid=user.id'],
  [/membership\?\.tenant_id\s*\|\|\s*(?:session\.)?user\.id/, 'fallback membership para user.id'],
  [/members\?\.length\s*\?\s*null\s*:\s*user\.id/, 'fallback sem associacao para user.id'],
]
let failed = false
for (const file of targets) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  for (const [pattern, label] of forbidden) if (pattern.test(source)) {
    console.error(`FAIL ${file}: ${label}`); failed = true
  }
}
const helper = fs.readFileSync(path.join(root, 'src/lib/tenant-auth.ts'), 'utf8')
for (const role of ['owner','manager','attendant','kitchen','motoboy','delivery']) {
  if (!helper.includes(`'${role}'`)) { console.error(`FAIL tenant-auth: papel ${role} ausente`); failed = true }
}
if (!helper.includes("from('usuarios_loja')") || !helper.includes(".eq('ativo', true)")) {
  console.error('FAIL tenant-auth: associacao ativa nao e exigida'); failed = true
}
const upload = fs.readFileSync(path.join(root, 'src/app/api/upload-cardapio-asset/route.ts'), 'utf8')
if (/tenantId:[^\n]*user\.id/.test(upload) || !upload.includes("['owner', 'manager'].includes(member.role)")) {
  console.error('FAIL upload-cardapio-asset: exige associacao ativa owner/manager sem fallback'); failed = true
}
const login = fs.readFileSync(path.join(root, 'src/app/api/auth/login/route.ts'), 'utf8')
if (!login.includes("a.role === 'owner' ? 0 : 1") || !login.includes("cookies.set('wd_active_tenant'")) {
  console.error('FAIL login: prioridade multi-loja/cookie ativo ausente'); failed = true
}
const layout = fs.readFileSync(path.join(root, 'src/app/(dashboard)/layout.tsx'), 'utf8')
const sidebar = fs.readFileSync(path.join(root, 'src/components/sidebar-nav.tsx'), 'utf8')
if (!layout.includes("role === 'attendant'") || !sidebar.includes("role === 'attendant'")) {
  console.error('FAIL attendant: restricao de layout/sidebar ausente'); failed = true
}
const register = fs.readFileSync(path.join(root, 'src/app/api/register/tenant/route.ts'), 'utf8')
if (!register.includes('await supabase.auth.getUser()') || /\buser_id\b[^\n]*= body/.test(register) || register.includes("upsert({tenant_id:user_id")) {
  console.error('FAIL register/tenant: identidade deve vir exclusivamente da sessao e vinculo existente deve ser rejeitado'); failed = true
}
if (!helper.includes("tenantStatus === 'active'") || !helper.includes('options.allowPending === true')) {
  console.error('FAIL tenant-auth: status operacional/pending controlado ausente'); failed = true
}
const sessionRoute = fs.readFileSync(path.join(root, 'src/app/api/auth/session/route.ts'), 'utf8')
if (!sessionRoute.includes('{ allowPending: true }')) {
  console.error('FAIL session: pending_approval nao foi preservado para redirecionamento'); failed = true
}
if (!upload.includes('wd_active_tenant=') || !upload.includes("tenant?.status === 'active'")) {
  console.error('FAIL upload: bearer nao respeita loja ativa/status operacional'); failed = true
}
if (!login.includes("['active', 'pending_approval'].includes(tenant.status)")) {
  console.error('FAIL login: status suspenso/inativo nao e bloqueado'); failed = true
}
if (!sidebar.includes("role === 'attendant' ? ['/dashboard', '/pedidos', '/clientes']")) {
  console.error('FAIL sidebar: clientes ausente para attendant'); failed = true
}
if (failed) process.exit(1)
console.log(`OK: ${targets.length} runtimes verificados; tenant ativo, upload, login e papeis coerentes`)



