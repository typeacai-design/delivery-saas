import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(request: Request) {
  try {
    const { supabase, tenantId } = await authenticatedTenant(['owner', 'manager', 'attendant'])
    if (!tenantId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { pedido_id, pago } = await request.json()

    if (!pedido_id) {
      return NextResponse.json({ error: 'pedido_id é obrigatório' }, { status: 400 })
    }

    // Authenticated membership above; use the server-side service role for order operations,
    // matching the order listing endpoint (which bypasses restrictive order RLS).
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Always scope the lookup by tenant to prevent cross-store access.
    const { data: pedido, error: fetchError } = await admin
      .from('pedidos')
      .select('id, codigo, tenant_id, valor_total, forma_pagamento, pago, tipo_pedido, sessao_mesa_id')
      .eq('id', pedido_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (fetchError) {
      console.error('Erro ao consultar pedido para pagamento:', fetchError)
      return NextResponse.json({ error: 'Erro ao consultar pedido' }, { status: 500 })
    }
    if (!pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado para esta loja' }, { status: 404 })
    }

    if (pedido.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Pedidos de mesa são quitados somente pelo fechamento atômico da comanda.
    if (pedido.tipo_pedido === 'mesa' || pedido.sessao_mesa_id) {
      return NextResponse.json({ error: 'O pagamento de pedidos de mesa deve ser realizado em Fechar Mesa' }, { status: 409 })
    }

    // No-op when already in the desired state; prevents duplicate cash entries.
    if (Boolean(pedido.pago) === pago) {
      return NextResponse.json({ success: true, pago, unchanged: true })
    }

    // Atualizar status de pagamento
    const { data: updated, error: updateError } = await admin
      .from('pedidos')
      .update({
        pago: pago,
        pago_em: pago ? new Date().toISOString() : null,
        pago_por: pago ? 'lojista' : null
      })
      .eq('id', pedido_id)
      .eq('tenant_id', tenantId)
      .eq('pago', !pago)
      .select('id')

    if (updateError) {
      console.error('Erro ao atualizar pago:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
    }

    if (!updated?.length) {
      return NextResponse.json({ success: true, pago, unchanged: true })
    }

    // Se está marcando como pago, registrar no fluxo de caixa
    if (pago) {
      const formaPagamento = Array.isArray(pedido.forma_pagamento)
        ? pedido.forma_pagamento[0]
        : pedido.forma_pagamento || 'outro'

      // Avoid inserting a second entry if one already exists for this order.
      const { data: existingMovement, error: movementLookupError } = await admin
        .from('movimentacoes_financeiras')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('referencia_id', pedido_id)
        .eq('tipo', 'entrada')
        .limit(1)
      if (movementLookupError) console.error('Erro ao consultar movimentação:', movementLookupError)
      const { error: lancError } = existingMovement?.length || movementLookupError ? { error: null } : await admin
        .from('movimentacoes_financeiras')
        .insert({
          tenant_id: tenantId,
          tipo: 'entrada',
          descricao: `Pedido #${pedido.codigo || pedido_id.slice(0, 8)}`,
          valor: pedido.valor_total,
          data: new Date().toISOString().split('T')[0], // campo date: YYYY-MM-DD
          categoria: 'venda',
          referencia_id: pedido_id,
          forma_pagamento: formaPagamento,
        })

      if (lancError) {
        console.error('Erro ao registrar movimentação:', lancError)
        // Não falha a operação principal, só loga o erro
      }
    } else {
      // Se está desmarcando pago, remover a movimentação do fluxo de caixa
      await admin
        .from('movimentacoes_financeiras')
        .delete()
        .eq('referencia_id', pedido_id)
        .eq('tenant_id', tenantId)
    }

    return NextResponse.json({ success: true, pago })

  } catch (error) {
    console.error('toggle_pago_error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
