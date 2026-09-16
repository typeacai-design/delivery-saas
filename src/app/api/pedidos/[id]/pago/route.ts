import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { authenticatedTenant } from '@/lib/tenant-auth'

export async function PATCH(request: Request) {
  try {
    const { user, tenantId } = await authenticatedTenant(['owner', 'manager', 'attendant'])
    if (!user || !tenantId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { pedido_id, pago } = await request.json()

    if (!pedido_id) {
      return NextResponse.json({ error: 'pedido_id é obrigatório' }, { status: 400 })
    }

    // service_role bypassa RLS — validação manual de tenant abaixo
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar se o pedido pertence ao tenant
    const { data: pedido, error: fetchError } = await admin
      .from('pedidos')
      .select('id, codigo, tenant_id, valor_total, forma_pagamento, pago')
      .eq('id', pedido_id)
      .single()

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    if (pedido.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Atualizar status de pagamento
    const { error: updateError } = await admin
      .from('pedidos')
      .update({
        pago: pago,
        pago_em: pago ? new Date().toISOString() : null,
        pago_por: pago ? 'lojista' : null
      })
      .eq('id', pedido_id)

    if (updateError) {
      console.error('Erro ao atualizar pago:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
    }

    // Se está marcando como pago, registrar no fluxo de caixa
    if (pago) {
      const formaPagamento = Array.isArray(pedido.forma_pagamento)
        ? pedido.forma_pagamento[0]
        : pedido.forma_pagamento || 'outro'

      const { error: lancError } = await admin
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
