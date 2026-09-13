import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Pega o tenant ativo
    const selected = (await cookies()).get('wd_active_tenant')?.value

    // Busca memberships do usuário
    const { data: members } = await supabase
      .from('usuarios_loja')
      .select('tenant_id, role, ativo')
      .eq('user_id', user.id)
      .eq('ativo', true)

    // Determina qual tenant usar
    const member = (selected && members?.find(m => m.tenant_id === selected)) || members?.[0]
    const tenantId = member?.tenant_id

    if (!tenantId) {
      return NextResponse.json({
        error: 'Sem acesso a nenhum tenant',
        userId: user.id,
        email: user.email,
        memberships: members
      }, { status: 403 })
    }

    // Conta pedidos
    const { count: totalPedidos } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    const { count: pedidosNovos } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'novo')

    // Busca últimos pedidos
    const { data: ultimosPedidos } = await supabase
      .from('pedidos')
      .select('id, status, data_criacao, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Busca dados do tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, nome')
      .eq('id', tenantId)
      .single()

    return NextResponse.json({
      ok: true,
      userId: user.id,
      email: user.email,
      tenantId,
      tenantNome: tenant?.nome,
      role: member?.role,
      memberships: members,
      selectedTenant: selected,
      totalPedidos,
      pedidosNovos,
      ultimosPedidos
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
