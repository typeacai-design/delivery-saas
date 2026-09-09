import { createFlavorSnapshot, flavorCount, parseComplements } from './flavor-pricing'
import { savedItemTotal } from './product-pricing'

export class FlavorValidationError extends Error {}
const invalid = (message: string): never => { throw new FlavorValidationError(message) }

/** Only IDs/count are trusted. All flavor prices, labels, membership and limits come from the database. */
export async function validateFlavorItem(db: any, tenantId: string, active: boolean, product: any, item: any) {
  if (!product.sabores_grupo_id) {
    if (item.sabores_quantidade != null || parseComplements(item.complementos).some(c => c.tipo === 'sabor')) invalid('Este produto nao esta configurado para divisao em sabores. Atualize o carrinho.')
    return null
  }
  if (!active) invalid('A divisao em sabores esta desativada nesta loja. Este produto esta temporariamente indisponivel.')
  if (!product.ativo) invalid('Produto indisponivel.')
  if (item.variante_id) invalid('Pizzas com sabores nao aceitam variacoes. Configure um produto para cada tamanho.')
  const count = Number(item.sabores_quantidade)
  if (!Number.isInteger(count) || count < 1 || count > Number(product.sabores_maximo) || count > 3) invalid('Escolha a quantidade de sabores desta pizza.')
  const quantity = Number(item.quantidade)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) invalid('Quantidade de pizzas invalida.')
  const [{ data: group, error: groupError }, { data: links, error: linksError }, { data: variants, error: variantsError }] = await Promise.all([
    db.from('categorias_complementos').select('id,tenant_id,ativo').eq('id', product.sabores_grupo_id).eq('tenant_id', tenantId).maybeSingle(),
    db.from('produto_complementos').select('complemento_id').eq('produto_id', product.id),
    db.from('variantes').select('id').eq('produto_id', product.id).limit(1),
  ])
  if (groupError || linksError || variantsError) throw new Error('Nao foi possivel validar os sabores. Tente novamente.')
  if (!group?.ativo) invalid('A lista de sabores esta indisponivel. Revise o cadastro do produto.')
  if (variants?.length) invalid('Pizzas com sabores nao aceitam variacoes. Configure um produto para cada tamanho.')
  const ids = (links || []).map((v: any) => v.complemento_id)
  const { data: options, error: optionsError } = ids.length
    ? await db.from('complementos').select('id,nome,preco,ativo,categoria_id,qtd_max,controlar_estoque,quantidade_estoque').eq('tenant_id', tenantId).in('id', ids)
    : { data: [], error: null }
  if (optionsError) throw new Error('Nao foi possivel validar os sabores. Tente novamente.')
  const catalog = new Map<string, any>((options || []).map((c: any) => [c.id, c]))
  const { data: tenantConfig, error: configError } = await db.from('tenants').select('config').eq('id', tenantId).single()
  if (configError) throw new Error('Nao foi possivel validar estoque.')
  const ignoreStock = tenantConfig?.config?.entrega_km?.vender_sem_estoque === true
  const submitted = parseComplements(item.complementos)
  if (new Set(submitted.map(c => c.id)).size !== submitted.length) invalid('Nao repita opcoes no pedido.')
  const flavors: any[] = []
  const extras: any[] = []
  const counts = new Map<string, number>()
  for (const selected of submitted) {
    const option = catalog.get(selected.id)
    if (!option?.ativo) invalid('Sabor ou adicional indisponivel para este produto.')
    const amount = Number(selected.quantidade)
    if (!Number.isInteger(amount) || amount < 1) invalid('Quantidade de adicional invalida.')
    if (option.categoria_id === product.sabores_grupo_id) {
      if (amount !== 1) invalid('Cada sabor deve ser selecionado uma unica vez.')
      if (option.controlar_estoque) invalid('Sabores com controle de estoque nao podem ser divididos. O lojista deve revisar a lista de sabores.')
      flavors.push(option)
    } else {
      if (amount > Number(option.qtd_max || 99)) invalid('Quantidade de adicional acima do limite.')
      if (!ignoreStock && option.controlar_estoque && amount * quantity > Number(option.quantidade_estoque || 0)) invalid(`${option.nome} sem estoque suficiente.`)
      extras.push({ id: option.id, nome: option.nome, quantidade: amount, valor: Number(option.preco) })
      if (option.categoria_id) counts.set(option.categoria_id, (counts.get(option.categoria_id) || 0) + amount)
    }
  }
  if (flavors.length !== count) invalid(`Selecione exatamente ${count} sabores distintos.`)
  const groupIds = [...new Set((options || []).map((c: any) => c.categoria_id).filter((id: any) => id && id !== product.sabores_grupo_id))]
  if (groupIds.length) {
    const { data: groups, error } = await db.from('categorias_complementos').select('id,qtd_minima,qtd_maxima,ativo,max_um_de_cada').eq('tenant_id', tenantId).in('id', groupIds)
    if (error) throw new Error('Nao foi possivel validar adicionais.')
    for (const g of groups || []) {
      const amount = counts.get(g.id) || 0
      if (!g.ativo && amount) invalid('Lista de adicionais indisponivel.')
      if (!g.ativo) continue
      if (g.max_um_de_cada && extras.some(e => catalog.get(e.id)?.categoria_id === g.id && e.quantidade > 1)) invalid('Escolha apenas uma unidade de cada adicional desta lista.')
      if (amount < Number(g.qtd_minima ?? (g.obrigatorio ? 1 : 0)) || amount > Number(g.qtd_maxima ?? g.max_selecoes ?? 99)) invalid('Adicionais fora dos limites da lista.')
    }
  }
  return { ...item, nome: product.nome, quantidade: quantity, valor_unitario: 0, variante_id: null, variante_nome: null,
    complementos: [...createFlavorSnapshot(flavors, product.sabores_grupo_id, count), ...extras] }
}

/** Manual legacy totals contain adjustments. Correct only flavor lines, preserving those adjustments. */
export async function normalizeManualFlavorItems(db: any, tenantId: string, items: any[]) {
  const { data: tenant, error: tenantError } = await db.from('tenants').select('sabores_ativo').eq('id', tenantId).single()
  const { data: products, error } = await db.from('produtos').select('id,nome,ativo,sabores_grupo_id,sabores_maximo').eq('tenant_id', tenantId).in('id', items.map(i => i.produto_id))
  if (error || tenantError) throw new Error('Nao foi possivel validar os sabores.')
  let adjustment = 0
  let hasFlavors = false
  const normalized = []
  for (const item of items) {
    const product = (products || []).find((p: any) => p.id === item.produto_id)
    if (!product) invalid('Produto indisponivel nesta loja.')
    const canonical = await validateFlavorItem(db, tenantId, tenant.sabores_ativo === true, product, item)
    if (canonical) { hasFlavors = true; adjustment += savedItemTotal(canonical) - savedItemTotal(item) }
    normalized.push(canonical || item)
  }
  return { items: normalized, hasFlavors, adjustment: Math.round(adjustment * 100) / 100 }
}

/** Match identifiers/quantities against server records, never trust submitted price metadata. */
export function unchangedSavedComposition(saved: any, item: any): boolean {
  if (!saved || saved.produto_id !== item.produto_id || (saved.variante_id || null) !== (item.variante_id || null)) return false
  const keys = (value: unknown) => parseComplements(value).map(c => `${c.id || c.nome}:${Number(c.quantidade ?? 1)}`).sort()
  return JSON.stringify(keys(saved.complementos)) === JSON.stringify(keys(item.complementos))
    && (!flavorCount(saved.complementos) || item.sabores_quantidade == null || Number(item.sabores_quantidade) === flavorCount(saved.complementos))
}

export function manualFlavorTotals(items: any[], body: any) {
  for (const item of items) {
    if (!Number.isInteger(Number(item.quantidade)) || Number(item.quantidade) < 1 || Number(item.quantidade) > 99
      || !Number.isFinite(Number(item.valor_unitario)) || Number(item.valor_unitario) < 0) invalid('Quantidade ou preco de item invalido.')
    for (const extra of parseComplements(item.complementos)) {
      const price = Number(extra.valor ?? extra.preco ?? 0)
      const amount = Number(extra.quantidade ?? 1)
      if (!Number.isFinite(price) || price < 0 || !Number.isInteger(amount) || amount < 1) invalid('Quantidade ou preco de adicional invalido.')
    }
  }
  const fee = Number(body.taxa_entrega || 0)
  const discount = Number(body.valor_desconto || 0)
  const surcharge = Number(body.valor_acrescimo || 0)
  if ([fee, discount, surcharge].some(value => !Number.isFinite(value) || value < 0)) invalid('Taxa, desconto ou acrescimo invalido.')
  const subtotal = Math.round(items.reduce((sum, item) => sum + savedItemTotal(item), 0) * 100) / 100
  if (!Number.isFinite(subtotal) || subtotal < 0) invalid('Subtotal invalido.')
  return { subtotal, total: Math.max(0, Math.round((subtotal + fee - discount + surcharge) * 100) / 100) }
}
