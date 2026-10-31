import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeReferral } from '@/lib/google-auth'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== 'true') {
    return NextResponse.redirect(new URL('/login?oauth_error=unavailable', origin))
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/auth/callback', origin).toString(), queryParams: { prompt: 'select_account' } },
    })
    if (error || !data.url) return NextResponse.redirect(new URL('/login?oauth_error=unavailable', origin))
    const response = NextResponse.redirect(data.url)
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.set('wd_google_ref', normalizeReferral(request.nextUrl.searchParams.get('ref')), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 1800,
    })
    return response
  } catch {
    return NextResponse.redirect(new URL('/login?oauth_error=unavailable', origin))
  }
}

