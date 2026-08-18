import { NextRequest, NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

// Dashboard chama isso pra verificar sessão E pegar tenant
export async function GET(request: NextRequest) {
  try {
    const { supabase, user, tenantId, role } = await authenticatedTenant(['owner','manager','attendant','kitchen','motoboy','delivery'], { allowPending: true })
    if (user && !tenantId) return NextResponse.json({ authenticated: true, authorized: false, role }, { status: 403 })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Pega tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, nome, status')
      .eq('id', tenantId!)
      .maybeSingle()

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      tenant,
      role,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

