import { NextResponse } from 'next/server'
import { authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export async function GET() {
  try {
    const auth = await authenticatedTenant(['owner'])
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { data: tenant } = await supabase
      .from('tenants')
      .select('onboarding_completed, onboarding_step')
      .eq('id', tenantId)
      .single()

    return NextResponse.json(tenant || { onboarding_completed: false, onboarding_step: 0 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticatedTenant(['owner'])
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const body = await request.json()
    const { step, completed } = body

    const updates: any = {}
    if (step !== undefined) updates.onboarding_step = step
    if (completed !== undefined) updates.onboarding_completed = completed

    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
