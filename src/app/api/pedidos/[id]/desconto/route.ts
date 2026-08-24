import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

export async function PATCH(request: Request) {
  try {
    const { supabase, tenantId } = await authenticatedTenant(['owner', 'manager', 'attendant'])
    if (!tenantId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Extrair ID do path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const pedidoId = pathParts[pathParts.length - 2] // /api/pedidos/[id]/desconto

    const { valor_desconto, valor_total } = await request.json()

    if (valor_desconto === undefined || valor_total === undefined) {
      return NextResponse.json({ error: 'valor_desconto e valor_total são obrigatórios' }, { status: 400 })
    }

    // Verificar se o pedido pertence ao tenant
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos')
      .select('id, tenant_id, valor_total, valor_desconto')
      .eq('id', pedidoId)
      .single()

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    if (pedido.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Atualizar desconto
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({
        valor_desconto: valor_desconto,
        valor_total: valor_total,
      })
      .eq('id', pedidoId)

    if (updateError) {
      console.error('Erro ao aplicar desconto:', updateError)
      return NextResponse.json({ error: 'Erro ao aplicar desconto' }, { status: 500 })
    }

    return NextResponse.json({ success: true, valor_desconto, valor_total })

  } catch (error) {
    console.error('desconto_error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
