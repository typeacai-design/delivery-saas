import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // Tenta buscar tenant
  let tenant = null
  if (user) {
    const { data: t } = await supabase
      .from('tenants')
      .select('id, status, nome')
      .eq('id', user.id)
      .maybeSingle()
    tenant = t
  }

  return NextResponse.json({
    sessionExists: !!session,
    sessionUser: session?.user?.id || null,
    sessionExpires: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    userExists: !!user,
    userId: user?.id || null,
    sessionError: sessionError?.message || null,
    userError: userError?.message || null,
    tenant: tenant,
    cookies: 'see headers',
  })
}
