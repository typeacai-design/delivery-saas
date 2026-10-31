import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

// Exercise handlers with isolated auth/database adapters; no real users or writes.
const root = new URL('../', import.meta.url)
const googleUser = { id: 'google-user', email: 'verified@example.com', email_confirmed_at: '2026-10-30', identities: [{ provider: 'google' }] }
function query(result, writes, table) {
  let op = 'select', payload
  const q = {
    select() { return q }, eq() { return q }, ilike() { return q },
    insert(value) { op = 'insert'; payload = value; writes.push({ table, op, value }); return q },
    delete() { op = 'delete'; writes.push({ table, op }); return q },
    limit() { return q }, maybeSingle() { return q }, single() { return q },
    then(resolve, reject) { return Promise.resolve(result(table, op, payload)).then(resolve, reject) },
  }
  return q
}
async function handler(path, options = {}) {
  const writes = [], cookies = new Map(), calls = []
  const context = vm.createContext({ URL, process: { env: { NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: options.enabled === false ? 'false' : 'true', NODE_ENV: 'test' } }, console: { error() {} } })
  const result = (table, op, payload) => {
    if (table === 'usuarios_loja') return op === 'insert' ? { error: options.memberInsertError || null } : { data: options.members || [], error: options.memberError || null }
    if (table === 'tenants') {
      if (op === 'insert') return { data: payload, error: null }
      return { data: path.includes('callback') ? { status: options.status || 'active' } : null, error: null }
    }
    return { data: null, error: null }
  }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: options.user === undefined ? googleUser : options.user }, error: null }),
      exchangeCodeForSession: async code => { calls.push(code); return { error: options.exchangeError || null } },
      signInWithOAuth: async args => { calls.push(args); return { data: { url: 'https://accounts.google.com/test' }, error: null } },
      admin: {
        listUsers: async () => ({ data: { users: [] } }),
        createUser: async args => { writes.push({ op: 'createUser', value: args }); return { data: { user: { id: 'password-user' } }, error: null } },
        deleteUser: async id => { writes.push({ op: 'deleteUser', id }) },
      },
    },
    from: table => query(result, writes, table),
  }
  const response = (body, init = {}) => ({ body, status: init.status || 200, headers: new Headers(init.headers), cookies: { set(name, value, options) { cookies.set(name, { value, options }) }, delete(name) { cookies.set(name, null) } } })
  const next = { NextResponse: { json: response, redirect: url => ({ ...response(null, { status: 307 }), location: String(url) }) } }
  const cache = new Map()
  async function load(file) {
    if (cache.has(file)) return cache.get(file)
    const text = await fs.readFile(new URL(file, root), 'utf8')
    const module = new vm.SourceTextModule(stripTypeScriptTypes(text), { context })
    cache.set(file, module)
    await module.link(async spec => {
      if (spec === '@/lib/google-auth') return load('src/lib/google-auth.ts')
      let exports
      if (spec === 'next/server') exports = next
      else if (spec === '@/lib/supabase/server' || spec === '@supabase/supabase-js') exports = { createClient: () => client }
      else throw new Error('Unexpected import: ' + spec)
      const stub = new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value) }, { context })
      return stub
    })
    return module
  }
  const module = await load(path)
  await module.evaluate()
  return { api: module.namespace, writes, cookies, calls }
}
const registerPath = 'src/app/api/register/tenant/route.ts'
const callbackPath = 'src/app/auth/callback/route.ts'
const member = { tenant_id: 'store', role: 'owner', ativo: true }
function request(body, origin = 'https://wedelivery.site') {
  return new Request('https://wedelivery.site/api/register/tenant', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
const signup = { auth_provider: 'google', nome: 'Test store', slug: 'test-store', email: 'forged@example.com', user_id: 'forged', password: '' }
function callback(url = 'https://wedelivery.site/auth/callback?code=test&next=https://evil.example', values = {}) {
  const nextUrl = new URL(url)
  return { nextUrl, cookies: { get: key => values[key] ? { value: values[key] } : undefined } }
}

test('Google signup derives identity/email from server and remains pending approval', async () => {
  const h = await handler(registerPath)
  const res = await h.api.POST(request(signup))
  assert.equal(res.status, 201)
  assert.equal(res.body.tenant.id, 'google-user')
  assert.equal(res.body.tenant.email, 'verified@example.com')
  assert.equal(res.body.tenant.status, 'pending_approval')
  assert.equal(h.writes.some(x => x.op === 'createUser'), false)
  assert.equal(h.cookies.get('wd_active_tenant').value, 'google-user')
})
for (const [name, user] of [['missing session', null], ['password-only account', { ...googleUser, identities: [{ provider: 'email' }] }], ['unverified email', { ...googleUser, email_confirmed_at: null }]]) {
  test('Google signup rejects ' + name, async () => {
    const h = await handler(registerPath, { user })
    assert.equal((await h.api.POST(request(signup))).status, 401)
    assert.equal(h.writes.length, 0)
  })
}
test('Google signup rejects cross-origin submission', async () => {
  const h = await handler(registerPath)
  assert.equal((await h.api.POST(request(signup, 'https://evil.example'))).status, 403)
  assert.equal(h.writes.length, 0)
})
test('Existing membership cannot create a duplicate store or reactivate itself', async () => {
  const h = await handler(registerPath, { members: [{ ...member, ativo: false }] })
  assert.equal((await h.api.POST(request(signup))).status, 409)
  assert.equal(h.writes.length, 0)
})
test('Failed membership creation never deletes the existing Google identity', async () => {
  const h = await handler(registerPath, { memberInsertError: { message: 'fixture failure' } })
  assert.equal((await h.api.POST(request(signup))).status, 500)
  assert.equal(h.writes.some(x => x.op === 'deleteUser'), false)
  assert.equal(h.writes.some(x => x.table === 'tenants' && x.op === 'delete'), true)
})
test('Password registration continues creating a password account', async () => {
  const h = await handler(registerPath)
  const res = await h.api.POST(request({ ...signup, auth_provider: 'password', password: 'test-password' }))
  assert.equal(res.status, 201)
  assert.equal(res.body.tenant.id, 'password-user')
  assert.equal(h.writes.filter(x => x.op === 'createUser').length, 1)
})
test('Password signup enforces eight characters', async () => {
  const h = await handler(registerPath)
  assert.equal((await h.api.POST(request({ ...signup, auth_provider: 'password', password: 'short' }))).status, 400)
  assert.equal(h.writes.length, 0)
})
for (const [name, options, target] of [
  ['new customer', {}, '/registro?google=1'],
  ['existing owner', { members: [member] }, '/dashboard'],
  ['pending store', { members: [member], status: 'pending_approval' }, '/aguardando-aprovacao'],
  ['suspended store', { members: [member], status: 'suspended' }, '/login?oauth_error=blocked'],
  ['inactive member', { members: [{ ...member, ativo: false }] }, '/login?oauth_error=blocked'],
  ['kitchen member', { members: [{ ...member, role: 'kitchen' }] }, '/acesso/cozinha'],
]) {
  test('Callback routes ' + name + ' without accepting an external next URL', async () => {
    const h = await handler(callbackPath, options)
    const res = await h.api.GET(callback())
    assert.equal(res.location, 'https://wedelivery.site' + target)
    assert.equal(h.calls.length, 1)
    assert.equal(res.headers.get('Cache-Control'), 'no-store')
  })
}
test('Callback rejects invalid PKCE exchange', async () => {
  const h = await handler(callbackPath, { exchangeError: new Error('invalid code') })
  assert.equal((await h.api.GET(callback())).location, 'https://wedelivery.site/login?oauth_error=failed')
})
test('Provider cancellation does not exchange a code', async () => {
  const h = await handler(callbackPath)
  assert.equal((await h.api.GET(callback('https://wedelivery.site/auth/callback?error=access_denied'))).location, 'https://wedelivery.site/login?oauth_error=cancelled')
  assert.equal(h.calls.length, 0)
})
test('Google remains unavailable until deployment configuration enables it', async () => {
  const h = await handler('src/app/auth/google/route.ts', { enabled: false })
  assert.equal((await h.api.GET(callback('https://wedelivery.site/auth/google'))).location, 'https://wedelivery.site/login?oauth_error=unavailable')
  assert.equal(h.calls.length, 0)
})
test('Google start uses fixed callback and only identification provider', async () => {
  const h = await handler('src/app/auth/google/route.ts')
  const res = await h.api.GET(callback('https://wedelivery.site/auth/google?ref=TEST'))
  assert.equal(res.location, 'https://accounts.google.com/test')
  assert.equal(h.calls[0].provider, 'google')
  assert.equal(h.calls[0].options.redirectTo, 'https://wedelivery.site/auth/callback')
  assert.equal(h.cookies.get('wd_google_ref').options.httpOnly, true)
})

