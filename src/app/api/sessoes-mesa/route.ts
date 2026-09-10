import { NextRequest, NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sessoes-mesa
 * Lista sessões ATIVAS (status='aberta') do tenant, ordenadas por mesa_numero
 * Inclui pedidos vinculados (para a aba Mesas do lojista)
 */
export async function GET(req: NextRequest) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const incluirFechadas = req.nextUrl.searchParams.get('fechadas') === '1'

  let query = supabase
    .from('sessoes_mesa')
    .select('id, mesa_numero, cliente_nome, cliente_whatsapp, valor_total, data_abertura, status, observacoes, pedidos(id, status, valor_total, data_criacao, tipo_pedido, codigo, pedido_itens(id, nome, quantidade))')
    .eq('tenant_id', tenantId)
    .order('data_abertura', { ascending: false })

  if (!incluirFechadas) {
    query = query.eq('status', 'aberta')
  }

  const { data: sessoes, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessoes: sessoes || [] })
}

/**
 * POST /api/sessoes-mesa
 * Cria nova sessão de mesa (vinculada ao lançar pedido tipo='mesa')
 * Body: { mesa_numero, cliente_nome, cliente_whatsapp?, observacoes? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const mesa_numero = String(body.mesa_numero || '').trim()
  const cliente_nome = String(body.cliente_nome || '').trim()
  if (!mesa_numero || !cliente_nome) {
    return NextResponse.json({ error: 'mesa_numero e cliente_nome são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sessoes_mesa')
    .insert({
      tenant_id: tenantId,
      mesa_numero,
      cliente_nome,
      cliente_whatsapp: body.cliente_whatsapp ? String(body.cliente_whatsapp).replace(/\D/g, '') : null,
      observacoes: body.observacoes || null,
      status: 'aberta',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessao: data })
}

/**
 * PATCH /api/sessoes-mesa?id=<uuid>
 * Atualiza status (reabrir, cancelar) ou dados da sessão
 */
export async function PATCH(req: NextRequest) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const update: any = {}
  if (body.status && ['aberta', 'fechada', 'cancelada'].includes(body.status)) {
    update.status = body.status
    if (body.status === 'fechada') update.data_fechamento = new Date().toISOString()
  }
  if (body.cliente_nome !== undefined) update.cliente_nome = body.cliente_nome
  if (body.cliente_whatsapp !== undefined) update.cliente_whatsapp = body.cliente_whatsapp
  if (body.observacoes !== undefined) update.observacoes = body.observacoes

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sessoes_mesa')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessao: data })
}
