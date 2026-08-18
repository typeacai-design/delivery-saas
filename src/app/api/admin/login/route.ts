import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { signAdminSessionPayload } from '@/lib/admin-auth'

const WINDOW_SECONDS = 15 * 60
const MAX_ATTEMPTS = 5

function clientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function hash(value: string, secret: string) {
  return createHash('sha256').update(value + secret).digest('hex')
}

export async function POST(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim()
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim()
  const envPassword = process.env.ADMIN_PASSWORD?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!adminEmail || !sessionSecret || !envPassword || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Configuração administrativa incompleta' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const cleanEmail = typeof body.email === 'string' ? body.email.trim() : ''
    const cleanPassword = typeof body.password === 'string' ? body.password.trim() : ''
    const supa = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const keyHash = createHash('sha256').update('admin-login:' + clientKey(request) + ':' + cleanEmail.toLowerCase()).digest('hex')
    const { data: allowed, error: limitError } = await supa.rpc('consume_api_rate_limit', {
      p_key_hash: keyHash, p_limit: MAX_ATTEMPTS, p_window_seconds: WINDOW_SECONDS,
    })
    if (limitError || allowed !== true) {
      if (limitError) console.warn('admin_login_rate_limit_unavailable', limitError.code || 'unknown')
      return NextResponse.json({ success: false, error: limitError ? 'Login temporariamente indisponível' : 'Muitas tentativas. Aguarde 15 minutos.' }, {
        status: limitError ? 503 : 429,
        headers: { ...(limitError ? {} : { 'Retry-After': String(WINDOW_SECONDS) }), 'Cache-Control': 'no-store' },
      })
    }
    if (!safeEqual(cleanEmail, adminEmail)) {
      await new Promise(resolve => setTimeout(resolve, 600))
      return NextResponse.json({ success: false, error: 'Credenciais incorretas' }, { status: 401 })
    }

    const { data: cfg } = await supa.from('saas_config').select('valor').eq('chave', 'admin').maybeSingle()
    const storedHash = (cfg?.valor as { senhaHash?: unknown } | null)?.senhaHash
    const valid = typeof storedHash === 'string'
      ? safeEqual(storedHash, hash(cleanPassword, sessionSecret))
      : safeEqual(cleanPassword, envPassword)
    if (!valid) {
      await new Promise(resolve => setTimeout(resolve, 600))
      return NextResponse.json({ success: false, error: 'Credenciais incorretas' }, { status: 401 })
    }

    const payload = JSON.stringify({ email: cleanEmail, iat: Math.floor(Date.now() / 1000) })
    const signature = signAdminSessionPayload(payload)
    if (!signature) return NextResponse.json({ success: false, error: 'Sessão indisponível' }, { status: 503 })
    const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set('admin_session', Buffer.from(payload).toString('base64url') + '.' + signature, {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: 60 * 60 * 8,
    })
    return response
  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('admin_session', '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
  return response
}
