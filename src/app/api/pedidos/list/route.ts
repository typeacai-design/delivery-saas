import { NextResponse } from 'next/server'
import { authenticatedTenant, MANAGEMENT_ROLES, tenantAuthStatus } from '@/lib/tenant-auth'
import { assinaturaVencida, billingClient } from '@/lib/assinaturas-server'
import { PEDIDOS_BLOQUEADOS } from '@/lib/assinaturas'

// API para o frontend buscar pedidos - usa SERVICE ROLE para bypass RLS
export async function GET() {
  try {
    const auth = await authenticatedTenant(MANAGEMENT_ROLES)
    const { user, tenantId } = auth
    const authStatus = tenantAuthStatus(auth)
    if (authStatus || !tenantId || !user) return NextResponse.json({ error: 'Acesso indisponível.' }, { status: authStatus ?? 403 })
    if (await assinaturaVencida(tenantId)) return NextResponse.json({ error: PEDIDOS_BLOQUEADOS }, { status: 402 })
    const supabaseAdmin = billingClient()

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
