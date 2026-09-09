import { chargedProductBase, savedItemTotal } from '@/lib/product-pricing'
import { FlavorValidationError, unchangedSavedComposition, validateFlavorItem } from '@/lib/flavor-order-server'
import { flavorCount, parseComplements } from '@/lib/flavor-pricing'
import { authenticatedTenant, SALES_ROLES, tenantAuthStatus } from '@/lib/tenant-auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Validate before a single transaction. Historical prices are sourced from saved rows.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticatedTenant(SALES_ROLES)
    const authStatus = tenantAuthStatus(auth)
    if (authStatus) return NextResponse.json({ error: 'Sem permissao' }, { status: authStatus })
    const { id } = await params
    const body = await request.json()
    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: current, error: currentError } = await admin.from('pedidos').select('tenant_id,valor_subtotal,taxa_entrega,valor_desconto,valor_total,data_atualizacao').eq('id', id).eq('tenant_id', auth.tenantId!).single()
    if (currentError || !current) return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 })
    const updates: any = {}
    for (const field of ['cliente_nome','cliente_whatsapp','endereco_entrega','numero_entrega','complemento_entrega','bairro_entrega','observacoes']) {
      if (body[field] !== undefined) updates[field] = body[field]
    }
    for (const field of ['taxa_entrega','valor_desconto']) {
      if (body[field] !== undefined) {
        if (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0) return NextResponse.json({ error: 'Valor invalido' }, { status: 400 })
        updates[field] = Number(body[field])
      }
    }
    let newItems: any[] | null = null
    if (body.itens !== undefined) {
      if (!Array.isArray(body.itens) || !body.itens.length) return NextResponse.json({ error: 'Pedido sem itens' }, { status: 400 })
      const [{ data: saved, error: savedError }, { data: products, error: productsError }, { data: tenant, error: tenantError }] = await Promise.all([
        admin.from('pedido_itens').select('*').eq('pedido_id', id),
        admin.from('produtos').select('id,nome,preco,ativo,exibir_preco_a_partir_de,sabores_grupo_id,sabores_maximo,controlar_estoque,quantidade_estoque').eq('tenant_id', auth.tenantId!).in('id', body.itens.map((i: any) => i.produto_id).filter(Boolean)),
        admin.from('tenants').select('sabores_ativo').eq('id', auth.tenantId!).single(),
      ])
      if (savedError || productsError || tenantError) throw new Error('Nao foi possivel validar o pedido.')
      newItems = []
      const used = new Set<string>()
      for (const item of body.itens) {
        if (!Number.isInteger(Number(item.quantidade)) || Number(item.quantidade) < 1 || Number(item.quantidade) > 99) throw new FlavorValidationError('Quantidade invalida.')
        const prior = (saved || []).find(row => !used.has(row.id) && (item.id ? row.id === item.id : unchangedSavedComposition(row, item)))
        if (prior && unchangedSavedComposition(prior, item)) {
          if (flavorCount(prior.complementos) && Number(item.quantidade) > Number(prior.quantidade)) {
            const currentProduct = (products || []).find(p => p.id === item.produto_id)
            if (!currentProduct?.sabores_grupo_id) throw new FlavorValidationError('Esta pizza nao esta mais configurada para sabores. Nao e possivel aumentar a quantidade.')
            if (currentProduct.controlar_estoque) throw new FlavorValidationError('Para preservar o estoque desta pizza, lance as unidades adicionais em um novo pedido.')
            await validateFlavorItem(admin, auth.tenantId!, tenant.sabores_ativo === true, currentProduct,
              { ...item, sabores_quantidade: flavorCount(prior.complementos), complementos: prior.complementos })
          }
          used.add(prior.id)
          newItems.push({ ...prior, quantidade: Number(item.quantidade), complementos: parseComplements(prior.complementos), observacao: item.observacao || null })
          continue
        }
        const product = (products || []).find(p => p.id === item.produto_id)
        if (!product) throw new FlavorValidationError('Produto indisponivel nesta loja.')
        const flavor = await validateFlavorItem(admin, auth.tenantId!, tenant.sabores_ativo === true, product, item)
        newItems.push(flavor || { ...item, nome: product.nome, quantidade: Number(item.quantidade), valor_unitario: chargedProductBase(product), complementos: parseComplements(item.complementos) })
      }
      updates.valor_subtotal = Math.round(newItems.reduce((sum, item) => sum + savedItemTotal(item), 0) * 100) / 100
    }
    const savedSurcharge = Math.max(0, Number(current.valor_total) - Number(current.valor_subtotal) - Number(current.taxa_entrega) + Number(current.valor_desconto))
    if (newItems || body.taxa_entrega !== undefined || body.valor_desconto !== undefined) {
      updates.valor_total = Math.max(0, Math.round((Number(updates.valor_subtotal ?? current.valor_subtotal) + Number(updates.taxa_entrega ?? current.taxa_entrega) - Number(updates.valor_desconto ?? current.valor_desconto) + savedSurcharge) * 100) / 100)
    }
    const { data: updated, error } = await admin.rpc('editar_pedido_sabores_atomico', {
      p_tenant_id: auth.tenantId!, p_pedido_id: id, p_updates: updates, p_itens: newItems, p_versao: current.data_atualizacao,
    })
    if (error) return NextResponse.json({ error: 'Nao foi possivel salvar. Atualize o pedido e tente novamente.' }, { status: 409 })
    return NextResponse.json({ ok: true, pedido: updated })
  } catch (error: any) {
    if (error instanceof FlavorValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('Erro ao editar pedido:', error)
    return NextResponse.json({ error: 'Nao foi possivel editar o pedido.' }, { status: 500 })
  }
}
