import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// API para o frontend buscar pedidos - usa SERVICE ROLE para bypass RLS
export async function GET() {
  try {
    // Primeiro pega o usuário autenticado via server client (com cookies)
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const supabaseAuth = await createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado', userId: null }, { status: 401 })
    }

    // Agora usa SERVICE ROLE para buscar pedidos (bypass RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Busca memberships
    const { data: members, error: membersError } = await supabaseAdmin
      .from('usuarios_loja')
      .select('tenant_id, role, ativo')
      .eq('user_id', user.id)
      .eq('ativo', true)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'Sem acesso a nenhum tenant', userId: user.id }, { status: 403 })
    }

    const tenantId = members[0].tenant_id

    // Busca pedidos com SERVICE ROLE (bypass RLS)
    const { data: pedidos, error } = await supabaseAdmin
      .from('pedidos')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('data_criacao', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Identificar o numero da mesa nos cards do Fluxo (desktop e mobile).
    const sessoesIds = [...new Set((pedidos || []).map((p: any) => p.sessao_mesa_id).filter(Boolean))]
    let numeroPorSessao = new Map<string, string>()
    if (sessoesIds.length) {
      const { data: sessoes, error: sessoesError } = await supabaseAdmin.from('sessoes_mesa')
        .select('id,mesa_numero').eq('tenant_id', tenantId).in('id', sessoesIds)
      if (sessoesError) return NextResponse.json({ error: sessoesError.message }, { status: 500 })
      numeroPorSessao = new Map((sessoes || []).map((s: any) => [s.id, s.mesa_numero]))
    }
    const pedidosComMesa = (pedidos || []).map((p: any) => ({
      ...p, mesa_numero: p.sessao_mesa_id ? numeroPorSessao.get(p.sessao_mesa_id) || null : null,
    }))

    return NextResponse.json({
      ok: true,
      tenantId,
      userId: user.id,
      count: pedidos?.length || 0,
      pedidos: pedidosComMesa
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
