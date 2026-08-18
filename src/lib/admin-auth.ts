import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'admin_session'
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

export type AdminSession = { email: string; iat: number }

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || ''
}

export function signAdminSessionPayload(payload: string): string | null {
  const secret = getSessionSecret()
  if (!secret) return null
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyAdminSessionCookie(value: string | undefined): AdminSession | null {
  if (!value) return null
  const [encodedPayload, signature] = value.split('.')
  if (!encodedPayload || !signature) return null
  let payload: string
  try { payload = Buffer.from(encodedPayload, 'base64url').toString('utf8') } catch { return null }
  const expectedSignature = signAdminSessionPayload(payload)
  if (!expectedSignature) return null
  try {
    const actual = Buffer.from(signature, 'hex')
    const expected = Buffer.from(expectedSignature, 'hex')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  } catch { return null }
  try {
    const parsed = JSON.parse(payload) as Partial<AdminSession>
    if (
      typeof parsed.email !== 'string' ||
      !parsed.email ||
      typeof parsed.iat !== 'number' ||
      !Number.isSafeInteger(parsed.iat)
    ) return null
    const adminEmail = process.env.ADMIN_EMAIL?.trim()
    if (!adminEmail || parsed.email !== adminEmail) return null
    const age = Math.floor(Date.now() / 1000) - parsed.iat
    if (age < 0 || age > ADMIN_SESSION_MAX_AGE_SECONDS) return null
    return { email: parsed.email, iat: parsed.iat }
  } catch { return null }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  return verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
}

export function adminUnauthorizedResponse() {
  return NextResponse.json({ error: 'Não autorizado' }, {
    status: 401,
    headers: { 'Cache-Control': 'no-store' },
  })
}
