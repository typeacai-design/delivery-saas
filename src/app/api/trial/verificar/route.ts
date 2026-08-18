import { NextResponse } from 'next/server'
import { authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export async function POST() {
  try {
    const auth = await authenticatedTenant(['owner'])
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    // Chamar função do banco que verifica trial
    const { error } = await supabase.rpc('fn_verificar_trial', { p_tenant_id: tenantId })

    if (error) throw error

    // Buscar status atual
    const { data: tenant } = await supabase
      .from('tenants')
      .select('bloqueado, motivo_bloqueio, em_ciclo_cobranca')
      .eq('id', tenantId)
      .single()

    return NextResponse.json(tenant)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const auth = await authenticatedTenant(['owner'])
    const { supabase, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, { status: authStatus })

    const { data: tenant } = await supabase
      .from('tenants')
      .select('bloqueado, motivo_bloqueio, em_ciclo_cobranca, data_inicio_trial')
      .eq('id', tenantId)
      .single()

    return NextResponse.json(tenant)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
