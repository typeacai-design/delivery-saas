import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// API para o frontend buscar pedidos (usa service role do servidor)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    console.log('[API PEDIDOS LIST] user:', user?.id, user?.email)

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado', userId: null }, { status: 401 })
    }

    // Busca memberships
    const { data: members, error: membersError } = await supabase
      .from('usuarios_loja')
      .select('tenant_id, role, ativo')
      .eq('user_id', user.id)
      .eq('ativo', true)

    console.log('[API PEDIDOS LIST] members:', JSON.stringify(members), 'error:', membersError?.message)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'Sem acesso a nenhum tenant', members: [] }, { status: 403 })
    }

    const tenantId = members[0].tenant_id
    console.log('[API PEDIDOS LIST] tenantId:', tenantId)

    // Busca pedidos
    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('data_criacao', { ascending: false })
      .limit(200)

    console.log('[API PEDIDOS LIST] pedidos count:', pedidos?.length, 'error:', error?.message)
    console.log('[API PEDIDOS LIST] tenant_id dos pedidos:', pedidos?.slice(0, 3).map(p => p.tenant_id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      tenantId,
      count: pedidos?.length || 0,
      pedidos: pedidos || []
    })
  } catch (err: any) {
    console.error('[API PEDIDOS LIST] Erro geral:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
