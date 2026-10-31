import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { googleDestination, normalizeReferral } from '@/lib/google-auth'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin))
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.delete('wd_google_ref')
    return response
  }
  const code = request.nextUrl.searchParams.get('code')
  if (!code || request.nextUrl.searchParams.has('error')) return redirect('/login?oauth_error=cancelled')
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return redirect('/login?oauth_error=failed')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return redirect('/login?oauth_error=failed')
    const { data: memberships, error: membershipError } = await supabase.from('usuarios_loja')
      .select('tenant_id,role,ativo').eq('user_id', user.id)
    if (membershipError) return redirect('/login?oauth_error=failed')
    // Inactive memberships must not be treated as a new customer signup.
    const ordered = [...(memberships || [])].sort((a, b) =>
      Number(b.ativo) - Number(a.ativo) || Number(b.role === 'owner') - Number(a.role === 'owner') || a.tenant_id.localeCompare(b.tenant_id))
    const member = ordered[0]
    let status: string | null = null
    if (member) {
      const { data: tenant, error: tenantError } = await supabase.from('tenants')
        .select('status').eq('id', member.tenant_id).maybeSingle()
      if (tenantError) return redirect('/login?oauth_error=failed')
      status = tenant?.status || null
    }
    let destination = googleDestination(ordered, status)
    const ref = normalizeReferral(request.cookies.get('wd_google_ref')?.value || null)
    if (!member && ref) destination += '&ref=' + encodeURIComponent(ref)
    const response = redirect(destination)
    response.cookies.set('wd_active_tenant', member?.ativo ? member.tenant_id : '', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
      maxAge: member?.ativo ? 60 * 60 * 24 * 365 : 0,
    })
    response.cookies.set('wd_employee_role', ['attendant', 'kitchen', 'motoboy'].includes(member?.role || '') ? member!.role : '', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
      maxAge: ['attendant', 'kitchen', 'motoboy'].includes(member?.role || '') ? 60 * 60 * 8 : 0,
    })
    return response
  } catch {
    return redirect('/login?oauth_error=failed')
  }
}

