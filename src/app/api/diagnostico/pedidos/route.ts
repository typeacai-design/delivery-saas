import { NextResponse } from 'next/server'
import { ALL_TENANT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

// API de diagnóstico para debugar pedidos
export async function GET() {
  try {
    const auth = await authenticatedTenant(ALL_TENANT_ROLES)
    const { supabase, tenantId, user, role } = auth
    const authStatus = tenantAuthStatus(auth)

    if (authStatus) {
      return NextResponse.json({
        error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão',
        authStatus,
        userId: user?.id,
        tenantId,
        role
      }, { status: authStatus })
    }

    // Busca pedidos
    const { data: pedidos, error, count } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Busca count total
    const { count: totalCount } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    return NextResponse.json({
      debug: true,
      tenantId,
      userId: user?.id,
      role,
      totalCount,
      pedidosCount: pedidos?.length || 0,
      pedidosSample: pedidos?.slice(0, 3),
      error: error?.message || null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
