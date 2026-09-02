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

    // Busca TODOS os pedidos SEM filtro de tenant (para ver se existem)
    const { data: todosPedidos, error: errorAll } = await supabase
      .from('pedidos')
      .select('id, tenant_id, status, created_at, data_criacao')
      .order('created_at', { ascending: false })
      .limit(20)

    // Busca pedidos DO TENANT
    const { data: pedidos, error, count } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Lista tenants do usuário
    const { data: minhasLojas } = await supabase
      .from('usuarios_loja')
      .select('tenant_id, role, ativo')
      .eq('user_id', user?.id)

    return NextResponse.json({
      debug: true,
      tenantId,
      userId: user?.id,
      role,
      minhasLojas,
      totalPedidosNoBanco: todosPedidos?.length || 0,
      pedidosDoTenant: pedidos?.length || 0,
      pedidosSample: pedidos?.slice(0, 3),
      todosSample: todosPedidos?.slice(0, 5),
      error: error?.message || null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
