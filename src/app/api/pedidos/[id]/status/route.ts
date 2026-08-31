import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

export async function PATCH(request: Request) {
  try {
    const { supabase, tenantId, user } = await authenticatedTenant(['owner', 'manager', 'attendant', 'kitchen'])
    if (!tenantId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { pedido_id, status, motivo_cancelamento, motivo_cancelamento_detalhe } = await request.json()

    if (!pedido_id || !status) {
      return NextResponse.json({ error: 'pedido_id e status são obrigatórios' }, { status: 400 })
    }

    // Validar status
    const statusValidos = ['novo', 'preparando', 'pronto', 'saiu', 'entregue', 'cancelado']
    if (!statusValidos.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    // Verificar se o pedido pertence ao tenant
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos')
      .select('id, codigo, tenant_id, status')
      .eq('id', pedido_id)
      .single()

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    if (pedido.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Sem permissão para alterar este pedido' }, { status: 403 })
    }

    // Validar transições de status
    const transicoesValidas: Record<string, string[]> = {
      novo: ['preparando', 'cancelado'],
      preparando: ['pronto', 'cancelado'],
      pronto: ['saiu', 'cancelado'],
      saiu: ['entregue', 'cancelado'],
      entregue: [],
      cancelado: [],
    }

    // Lojista pode sempre cancelar, mas só pode avançar status em sequência
    if (status !== 'cancelado' && !transicoesValidas[pedido.status]?.includes(status)) {
      return NextResponse.json({
        error: `Não é possível mudar de '${pedido.status}' para '${status}'`
      }, { status: 400 })
    }

    // Preparar updates
    const updates: any = {
      status,
      data_atualizacao: new Date().toISOString(),
    }

    // Se for cancelamento
    if (status === 'cancelado') {
      updates.motivo_cancelamento = motivo_cancelamento || null
      updates.motivo_cancelamento_detalhe = motivo_cancelamento_detalhe || null
      updates.cancelado_por = 'lojista'
      updates.cancelado_em = new Date().toISOString()
    }

    // Se for entrega
    if (status === 'entregue') {
      updates.entregue_em = new Date().toISOString()
    }

    // Atualizar status
    const { error: updateError } = await supabase
      .from('pedidos')
      .update(updates)
      .eq('id', pedido_id)
      .eq('tenant_id', tenantId) // Garantir que só atualiza se pertencer ao tenant

    if (updateError) {
      console.error('Erro ao atualizar status:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 })
    }

    // Registrar na auditoria
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/auditoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: user?.id,
          acao: 'atualizar',
          tabela: 'pedidos',
          registro_id: pedido_id,
          dados_anteriores: { status: pedido.status },
          dados_novos: { status },
        }),
      })
    } catch (e) {
      console.error('Erro ao registrar auditoria:', e)
      // Não falha a operação principal
    }

    return NextResponse.json({ success: true, status })

  } catch (error) {
    console.error('update_status_error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
