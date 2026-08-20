import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// PATCH /api/pedidos/[id] - editar pedido (lojista)
// Body: { itens: [...], cliente: {...}, endereco: {...}, taxa_entrega: N }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Busca pedido atual
    const { data: pedidoAtual } = await admin
      .from('pedidos')
      .select('tenant_id, valor_subtotal, taxa_entrega, valor_desconto, valor_total')
      .eq('id', id)
      .single()

    if (!pedidoAtual) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const updates: any = { data_atualizacao: new Date().toISOString() }

    // Atualiza endereço/dados do cliente
    if (body.cliente_nome !== undefined) updates.cliente_nome = body.cliente_nome
    if (body.cliente_whatsapp !== undefined) updates.cliente_whatsapp = body.cliente_whatsapp
    if (body.endereco_entrega !== undefined) updates.endereco_entrega = body.endereco_entrega
    if (body.numero_entrega !== undefined) updates.numero_entrega = body.numero_entrega
    if (body.complemento_entrega !== undefined) updates.complemento_entrega = body.complemento_entrega
    if (body.bairro_entrega !== undefined) updates.bairro_entrega = body.bairro_entrega
    if (body.observacoes !== undefined) updates.observacoes = body.observacoes
    if (body.taxa_entrega !== undefined) updates.taxa_entrega = body.taxa_entrega

    // Se enviou itens, recalcula tudo
    if (Array.isArray(body.itens) && body.itens.length > 0) {
      const ids = body.itens.map((i: any) => i.produto_id).filter(Boolean)
      const { data: produtosDb } = await admin
        .from('produtos')
        .select('id, nome, preco')
        .in('id', ids)

      const { data: itensAtuais } = await admin
        .from('pedido_itens')
        .select('id')
        .eq('pedido_id', id)

      // Remove itens antigos
      if (itensAtuais && itensAtuais.length) {
        const idsAntigos = itensAtuais.map((i: any) => i.id)
        await admin.from('pedido_itens').delete().in('id', idsAntigos)
      }

      // Insere novos
      const novosItens = body.itens.map((item: any) => {
        const prod = (produtosDb || []).find((p: any) => p.id === item.produto_id)
        return {
          pedido_id: id,
          produto_id: item.produto_id,
          nome: prod?.nome || item.nome || 'Item',
          quantidade: item.quantidade || 1,
          valor_unitario: prod?.preco || item.valor_unitario || 0,
          variante_id: item.variante_id || null,
          variante_nome: item.variante_nome || null,
          complementos: item.complementos || [],
          observacao: item.observacao || null,
        }
      })

      if (novosItens.length > 0) {
        const { error: itensError } = await admin.from('pedido_itens').insert(novosItens)
        if (itensError) throw itensError
      }

      // Recalcula subtotal
      const novoSubtotal = novosItens.reduce((acc: number, item: any) => {
        const compTotal = (item.complementos || []).reduce((s: number, c: any) => s + (c.valor || 0) * (c.quantidade || 1), 0)
        return acc + (item.valor_unitario + compTotal) * item.quantidade
      }, 0)

      updates.valor_subtotal = novoSubtotal
      const taxa = body.taxa_entrega !== undefined ? body.taxa_entrega : pedidoAtual.taxa_entrega
      const desconto = body.valor_desconto !== undefined ? body.valor_desconto : pedidoAtual.valor_desconto
      updates.valor_total = Math.max(0, novoSubtotal + (taxa || 0) - (desconto || 0))
    }

    if (body.valor_desconto !== undefined) {
      updates.valor_desconto = body.valor_desconto
      const taxa = body.taxa_entrega !== undefined ? body.taxa_entrega : pedidoAtual.taxa_entrega
      const sub = updates.valor_subtotal !== undefined ? updates.valor_subtotal : pedidoAtual.valor_subtotal
      updates.valor_total = Math.max(0, sub + (taxa || 0) - body.valor_desconto)
    }

    const { data: pedidoAtualizado, error } = await admin
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, pedido: pedidoAtualizado })
  } catch (error: any) {
    console.error('Erro ao editar pedido:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}