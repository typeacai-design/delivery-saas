import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

const MAX_AGE_SECONDS = 60 * 60 * 8

function validAdminCookie(value: string | undefined) {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim()
  const adminEmail = process.env.ADMIN_EMAIL?.trim()
  if (!value || !secret || !adminEmail) return false
  const [encoded, signature] = value.split('.')
  if (!encoded || !signature) return false
  try {
    const payload = Buffer.from(encoded, 'base64url').toString('utf8')
    const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'), 'hex')
    const actual = Buffer.from(signature, 'hex')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false
    const parsed: unknown = JSON.parse(payload)
    if (!parsed || typeof parsed !== 'object') return false
    const session = parsed as { email?: unknown; iat?: unknown }
    if (session.email !== adminEmail || !Number.isSafeInteger(session.iat)) return false
    const age = Math.floor(Date.now() / 1000) - (session.iat as number)
    return age >= 0 && age <= MAX_AGE_SECONDS
  } catch { return false }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (process.env.NODE_ENV === 'production' && pathname === '/teste') {
    return new NextResponse(null, { status: 404 })
  }
  if (pathname.startsWith('/painel-admin') && pathname !== '/painel-admin/login') {
    if (!validAdminCookie(request.cookies.get('admin_session')?.value)) {
      const loginUrl = new URL('/painel-admin/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  const response = NextResponse.next()
  if (pathname.startsWith('/avaliar/')) {
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
