import { removeReferenceCharges } from '@/lib/product-pricing'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticatedTenant } from '@/lib/tenant-auth'

// POST /api/pedidos/manual - Lancamento manual de pedidos pelo lojista
// Usa service_role para bypassar RLS (a autenticacao foi validada acima)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  try {
    // Autenticar e descobrir o tenant
    const auth = await authenticatedTenant(['owner', 'manager', 'attendant'])
    if (!auth.tenantId) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    const body = await request.json()
    const {
      cliente_id,
      cliente_nome,
      cliente_whatsapp,
      itens,
      valor_subtotal,
      taxa_entrega,
      valor_desconto,
      valor_total,
      forma_pagamento,
      troco_para,
      bairro_entrega,
      taxa_bairro,
      observacoes,
      tipo_entrega,
      endereco,
      numero,
      complemento,
    } = body

    if (!itens || itens.length === 0) {
      return NextResponse.json({ error: 'Pedido sem itens' }, { status: 400 })
    }

    const admin = adminClient()

    const { data: priceProducts, error: priceError } = await admin.from('produtos')
      .select('id,preco,exibir_preco_a_partir_de').eq('tenant_id', auth.tenantId)
      .in('id', itens.map((item: any) => item.produto_id))
    if (priceError) return NextResponse.json({ error: 'Nao foi possivel validar os precos' }, { status: 500 })
    if (itens.some((item: any) => !priceProducts?.some(product => product.id === item.produto_id))) {
      return NextResponse.json({ error: 'Produto indisponivel nesta loja' }, { status: 400 })
    }
    const pricing = removeReferenceCharges(itens, priceProducts || [])
    const subtotalCorrigido = Math.max(0, Math.round((Number(valor_subtotal || 0) - pricing.removed) * 100) / 100)
    const totalCorrigido = Math.max(0, Math.round((Number(valor_total || 0) - pricing.removed) * 100) / 100)


    // Criar pedido (service_role bypassa RLS)
    const { data: pedido, error: pedidoError } = await admin
      .from('pedidos')
      .insert({
        tenant_id: auth.tenantId,
        cliente_id: cliente_id || null,
        cliente_nome: cliente_nome || 'Cliente',
        cliente_whatsapp: cliente_whatsapp?.replace(/\D/g, '') || null,
        valor_subtotal: subtotalCorrigido,
        taxa_entrega: taxa_entrega || 0,
        valor_desconto: valor_desconto || 0,
        valor_total: totalCorrigido,
        forma_pagamento: forma_pagamento ? [forma_pagamento] : ['dinheiro'],
        valor_pago: [totalCorrigido],
        troco: troco_para || 0,
        observacoes: observacoes || null,
        tipo_entrega: tipo_entrega || 'delivery',
        status: 'novo',
        bairro_entrega: bairro_entrega || null,
        taxa_bairro: taxa_bairro || 0,
        endereco_entrega: endereco || null,
        numero_entrega: numero || null,
        complemento_entrega: complemento || null,
      })
      .select()
      .single()

    if (pedidoError) {
      console.error('pedido insert error:', pedidoError)
      return NextResponse.json({ error: pedidoError.message }, { status: 500 })
    }

    // Criar itens do pedido
    const itensParaInserir = pricing.items.map((item: any) => ({
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      nome: item.nome,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      complementos: item.complementos || [],
      observacao: item.observacao || null,
      pontos: item.pontos || 0,
    }))

    const { error: itensError } = await admin
      .from('pedido_itens')
      .insert(itensParaInserir)

    if (itensError) {
      // Rollback: deletar pedido criado
      await admin.from('pedidos').delete().eq('id', pedido.id)
      console.error('itens insert error:', itensError)
      return NextResponse.json({ error: itensError.message }, { status: 500 })
    }

    return NextResponse.json({
      ...pedido,
      itens: itensParaInserir,
    })
  } catch (error: any) {
    console.error('pedido_manual_error:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar pedido' }, { status: 500 })
  }
}
