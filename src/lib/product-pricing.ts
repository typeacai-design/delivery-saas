interface ProductPrice {
  preco: number | string
  exibir_preco_a_partir_de?: boolean | null
}

/** The explicit catalog flag makes the displayed price a reference, not a charge. */
export function chargedProductBase(product: ProductPrice, variantPrice = 0): number {
  return product.exibir_preco_a_partir_de === true
    ? 0
    : Number(product.preco) + Number(variantPrice || 0)
}

/** Normalize open carts only; saved orders must keep their original prices. */
export function normalizeCartPrices<T extends { produto_id: string; valor_unitario: number; variante_preco?: number }>(
  items: T[], products: (ProductPrice & { id: string })[],
): T[] {
  const catalog = new Map(products.map(product => [product.id, product]))
  return items.map(item => {
    const product = catalog.get(item.produto_id)
    if (!product) return item
    return {
      ...item,
      valor_unitario: chargedProductBase(product),
      variante_preco: product.exibir_preco_a_partir_de === true ? 0 : item.variante_preco,
    }
  })
}

/** Remove stale reference charges from manual requests, preserving existing adjustments. */
export function removeReferenceCharges<T extends { produto_id: string; valor_unitario: number; quantidade: number }>(
  items: T[], products: (ProductPrice & { id: string })[],
) {
  const catalog = new Map(products.map(product => [product.id, product]))
  let removed = 0
  const normalized = items.map(item => {
    const product = catalog.get(item.produto_id)
    if (product?.exibir_preco_a_partir_de !== true) return item
    removed += Number(item.valor_unitario || 0) * Number(item.quantidade)
    return { ...item, valor_unitario: 0 }
  })
  return { items: normalized, removed: Math.round(removed * 100) / 100 }
}

/** Render saved prices without consulting today's catalog. */
export function savedItemTotal(item: { valor_unitario: number | string; quantidade: number; complementos?: unknown }): number {
  let complements = item.complementos
  if (typeof complements === 'string') {
    try { complements = JSON.parse(complements) } catch { complements = [] }
  }
  const extra = Array.isArray(complements)
    ? complements.reduce((sum, complement) => sum + Number(complement.valor ?? complement.preco ?? 0) * Number(complement.quantidade ?? 1), 0)
    : 0
  return Math.round((Number(item.valor_unitario) + extra) * Number(item.quantidade) * 100) / 100
}
