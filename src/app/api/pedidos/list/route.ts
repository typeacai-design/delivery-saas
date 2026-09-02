import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// API para o frontend buscar pedidos (usa service role do servidor)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Busca memberships
    const { data: members } = await supabase
      .from('usuarios_loja')
      .select('tenant_id, role, ativo')
      .eq('user_id', user.id)
      .eq('ativo', true)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'Sem acesso a nenhum tenant' }, { status: 403 })
    }

    const tenantId = members[0].tenant_id

    // Busca pedidos
    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('data_criacao', { ascending: false })
      .limit(200)

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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
