import { NextRequest, NextResponse } from 'next/server'
import { SALES_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sessoes-mesa
 * Lista sessões ATIVAS (status='aberta') do tenant, ordenadas por mesa_numero
 * Inclui pedidos vinculados (para a aba Mesas do lojista)
 */
export async function GET(req: NextRequest) {
  const auth = await authenticatedTenant(SALES_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const incluirFechadas = req.nextUrl.searchParams.get('fechadas') === '1'

  // The order list uses service role because merchant RLS can hide rows.
  // Scope both sessions and nested orders to the authenticated tenant.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  let query = admin.from('sessoes_mesa')
    .select('id, tenant_id, mesa_numero, cliente_nome, cliente_whatsapp, valor_total, data_abertura, status, observacoes')
    .eq('tenant_id', tenantId)
    .order('data_abertura', { ascending: false })
  if (!incluirFechadas) query = query.eq('status', 'aberta')
  const { data: sessoes, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = (sessoes || []).map(s => s.id)
  if (!ids.length) return NextResponse.json({ sessoes: [] })
  const { data: pedidos, error: pedidosError } = await admin.from('pedidos')
    .select('id, sessao_mesa_id, status, valor_total, data_criacao, tipo_pedido, codigo')
    .eq('tenant_id', tenantId).in('sessao_mesa_id', ids)
  if (pedidosError) return NextResponse.json({ error: pedidosError.message }, { status: 500 })
  const pedidoIds = (pedidos || []).map(p => p.id)
  const { data: itens, error: itensError } = pedidoIds.length
    ? await admin.from('pedido_itens').select('id, pedido_id, nome, quantidade').in('pedido_id', pedidoIds)
    : { data: [], error: null }
  if (itensError) return NextResponse.json({ error: itensError.message }, { status: 500 })
  const itensPorPedido = new Map<string, any[]>()
  for (const item of itens || []) {
    const list = itensPorPedido.get(item.pedido_id) || []
    list.push(item)
    itensPorPedido.set(item.pedido_id, list)
  }
  const pedidosPorSessao = new Map<string, any[]>()
  for (const pedido of pedidos || []) {
    const list = pedidosPorSessao.get(pedido.sessao_mesa_id) || []
    list.push({ ...pedido, pedido_itens: itensPorPedido.get(pedido.id) || [] })
    pedidosPorSessao.set(pedido.sessao_mesa_id, list)
  }
  const sessoesComPedidos = (sessoes || []).map(sessao => ({
    ...sessao, pedidos: pedidosPorSessao.get(sessao.id) || []
  }))
  return NextResponse.json({ sessoes: sessoesComPedidos })
}

/**
 * POST /api/sessoes-mesa
 * Cria nova sessão de mesa (vinculada ao lançar pedido tipo='mesa')
 * Body: { mesa_numero, cliente_nome, cliente_whatsapp?, observacoes? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticatedTenant(SALES_ROLES)
  const authStatus = tenantAuthStatus(auth)
  // Debug temporário para investigar erro 'Sem permissão' persistente
  console.log('[sessoes-mesa][POST]', { tenantId: auth.tenantId, role: auth.role, userId: auth.user?.id, authStatus, allowed: SALES_ROLES })
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const mesa_numero = String(body.mesa_numero || '').trim()
  const cliente_nome = String(body.cliente_nome || '').trim()
  if (!mesa_numero || !cliente_nome) {
    return NextResponse.json({ error: 'mesa_numero e cliente_nome são obrigatórios' }, { status: 400 })
  }

  const { data: mesaExistente, error: buscaError } = await supabase
    .from('sessoes_mesa').select('id').eq('tenant_id', tenantId)
    .eq('mesa_numero', mesa_numero).eq('status', 'aberta').maybeSingle()
  if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 500 })
  if (mesaExistente) return NextResponse.json({ error: 'Esta mesa já possui uma comanda aberta' }, { status: 409 })

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
  const auth = await authenticatedTenant(SALES_ROLES)
  const authStatus = tenantAuthStatus(auth)
  if (authStatus) return NextResponse.json({ error: authStatus === 401 ? 'Não autenticado' : 'Sem permissão' }, { status: authStatus })

  const { supabase, tenantId } = auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  // Uma comanda já quitada não pode ser reaberta nem cancelada sem estorno financeiro.
  if (body.status === 'aberta' || body.status === 'cancelada') {
    const { data: atual, error: atualError } = await supabase.from('sessoes_mesa')
      .select('status,valor_total_recebido').eq('id', id).eq('tenant_id', tenantId).single()
    if (atualError || !atual) return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
    if (atual.status === 'fechada' && Number(atual.valor_total_recebido || 0) > 0) {
      return NextResponse.json({ error: 'Mesa quitada não pode ser reaberta ou cancelada sem estorno' }, { status: 409 })
    }
  }

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
