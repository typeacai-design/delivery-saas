import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

export async function DELETE(request: Request) {
  try {
    const { supabase, tenantId } = await authenticatedTenant(['owner', 'manager'])
    if (!tenantId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const pedidoId = pathParts[pathParts.length - 2]

    // Verificar se o pedido pertence ao tenant e esta cancelado
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos')
      .select('id, tenant_id, status')
      .eq('id', pedidoId)
      .single()

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    if (pedido.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (pedido.status !== 'cancelado') {
      return NextResponse.json({ error: 'Só é possível apagar pedidos cancelados' }, { status: 400 })
    }

    // Soft delete: marcar como apagado (ativo = false) e mover para tabela de auditoria
    // Primeiro, copiar para a tabela de pedidos_apagados se existir
    try {
      await supabase.from('pedidos_apagados').insert({
        pedido_id: pedidoId,
        tenant_id: tenantId,
        apagado_em: new Date().toISOString(),
      })
    } catch {
      // Tabela pode não existir, tudo bem
    }

    // Marcar pedido como inativo (soft delete)
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', pedidoId)

    if (updateError) {
      console.error('Erro ao apagar pedido:', updateError)
      return NextResponse.json({ error: 'Erro ao apagar' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Pedido apagado' })

  } catch (error) {
    console.error('apagar_pedido_error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
