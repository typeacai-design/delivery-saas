import { FlavorValidationError, normalizeManualFlavorItems, manualFlavorTotals } from '@/lib/flavor-order-server'
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
      tipo_pedido,
      sessao_mesa_id,
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
    const referencePricing = removeReferenceCharges(itens, priceProducts || [])
    const flavorPricing = await normalizeManualFlavorItems(admin, auth.tenantId!, referencePricing.items)
    const pricing = { items: flavorPricing.items, removed: referencePricing.removed - flavorPricing.adjustment }
    const flavorTotals = flavorPricing.hasFlavors ? manualFlavorTotals(pricing.items, body) : null
    const subtotalCorrigido = flavorTotals?.subtotal ?? Math.max(0, Math.round((Number(valor_subtotal || 0) - pricing.removed) * 100) / 100)
    const totalCorrigido = flavorTotals?.total ?? Math.max(0, Math.round((Number(valor_total || 0) - pricing.removed) * 100) / 100)


    // Criar pedido (service_role bypassa RLS)
    const itensParaInserir = pricing.items.map((item: any) => ({
      produto_id: item.produto_id,
      nome: item.nome,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      complementos: item.complementos || [],
      observacao: item.observacao || null,
      pontos: item.pontos || 0,
    }))
    const { data: pedido, error: pedidoError } = await admin.rpc('criar_pedido_manual_atomico', {
      p_tenant_id: auth.tenantId, p_pedido: {
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
        tipo_pedido: tipo_pedido || tipo_entrega || 'delivery',
        sessao_mesa_id: sessao_mesa_id || null,
        status: 'novo',
        bairro_entrega: bairro_entrega || null,
        taxa_bairro: taxa_bairro || 0,
        endereco_entrega: endereco || null,
        numero_entrega: numero || null,
        complemento_entrega: complemento || null,
      }, p_itens: itensParaInserir,
    })
    if (pedidoError || !pedido) throw new Error('Nao foi possivel salvar o pedido. Nenhum item foi gravado.')


    return NextResponse.json({
      ...pedido,
      itens: itensParaInserir,
    })
  } catch (error: any) {
    if (error instanceof FlavorValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('pedido_manual_error:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar pedido' }, { status: 500 })
  }
}
