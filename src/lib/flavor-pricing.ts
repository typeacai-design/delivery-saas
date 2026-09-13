export interface FlavorComplement {
  id: string
  nome: string
  quantidade: 1
  valor: number
  tipo: 'sabor'
  grupo_id: string
  fracao_denominador: number
  preco_integral: number
  regra_preco: 'media_v1'
}

export function parseComplements(value: unknown): any[] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return [] }
  }
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []
}

export function flavorCount(value: unknown): number | null {
  const flavors = parseComplements(value).filter(c => c.tipo === 'sabor' && c.regra_preco === 'media_v1')
  if (!flavors.length) return null
  const count = flavors[0].fracao_denominador
  return Number.isInteger(count) && count >= 1 && count <= 3 && flavors.length === count
    && flavors.every(c => c.fracao_denominador === count) ? count : null
}

export function flavorLabel(c: any): string {
  return c?.tipo === 'sabor' && c?.regra_preco === 'media_v1'
    ? `${c.fracao_denominador > 1 ? `1/${c.fracao_denominador} ` : ''}${c.nome || ''}`
    : String(c?.nome || '')
}

/** Allocate rounded mean in cents, independent of selection order. Full prices remain immutable. */
export function createFlavorSnapshot(flavors: { id: string; nome: string; preco: number | string }[], groupId: string, count: number): FlavorComplement[] {
  if (!groupId || !Number.isInteger(count) || count < 1 || count > 3 || flavors.length !== count
    || new Set(flavors.map(f => f.id)).size !== count) throw new Error('Selecione exatamente a quantidade de sabores escolhida, sem repetir sabores.')
  const parts = flavors.map(f => {
    const price = Number(f.preco)
    if (!f.id || !Number.isFinite(price) || price < 0) throw new Error('Preco de sabor invalido.')
    const cents = Math.round(price * 100)
    if (!Number.isSafeInteger(cents)) throw new Error('Preco de sabor invalido.')
    return { flavor: f, cents, share: Math.floor(cents / count), remainder: cents % count }
  })
  let remaining = Math.round(parts.reduce((s, p) => s + p.cents, 0) / count) - parts.reduce((s, p) => s + p.share, 0)
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder || a.flavor.id.localeCompare(b.flavor.id))) {
    if (remaining-- > 0) part.share += 1
  }
  return parts.map(p => ({ id: p.flavor.id, nome: p.flavor.nome, quantidade: 1, valor: p.share / 100,
    tipo: 'sabor', grupo_id: groupId, fracao_denominador: count, preco_integral: p.cents / 100, regra_preco: 'media_v1' }))
}
