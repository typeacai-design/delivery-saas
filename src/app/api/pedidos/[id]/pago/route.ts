import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

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

    // Verificar se o pedido pertence ao tenant
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos')
      .select('id, tenant_id')
      .eq('id', pedido_id)
      .single()

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    if (pedido.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Atualizar status de pagamento
    const { error: updateError } = await supabase
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

    return NextResponse.json({ success: true, pago })

  } catch (error) {
    console.error('toggle_pago_error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
