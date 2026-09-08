import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/55${clean}?text=${encoded}`
}

/**
 * Formata o código de exibição de um pedido.
 *
 * Preferência: usa o `codigo` salvo no banco (sequencial por tenant/ano,
 * formato XXXXX/YY — gerado pela migration 053). Se o banco não retornou
 * `codigo`, gera um fallback determinístico a partir do id (hash de 5 dígitos)
 * para evitar mostrar IDs brutos na UI.
 *
 *  - id "abcd-..." + createdAt → usa `codigo` salvo, ou
 *    "00021/26" como fallback.
 */
export function formatarCodigoPedido(id: string, createdAt?: string | null, codigoSalvo?: string | null): string {
  if (codigoSalvo && typeof codigoSalvo === 'string' && codigoSalvo.includes('/')) {
    return codigoSalvo
  }

  const year = (() => {
    if (createdAt) {
      const d = new Date(createdAt)
      if (!Number.isNaN(d.getTime())) return String(d.getFullYear()).slice(-2)
    }
    return String(new Date().getFullYear()).slice(-2)
  })()

  const numericId = (() => {
    if (!id) return '00000'
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
    }
    return String(Math.abs(hash) % 100000).padStart(5, '0')
  })()

  return `${numericId}/${year}`
}

/**
 * Ordena uma lista de complementos seguindo a regra padrão do sistema:
 * 1. Complementos com preço zero (GRÁTIS) sempre no topo
 * 2. Demais complementos em ordem alfabética (A → Z)
 *
 * Essa regra vale para todas as listas de complementos e todos os lojistas.
 *
 * Aceita comparação locale-aware para tratar acentos corretamente.
 *
 * @example
 *   ordenarComplementos([
 *     { nome: 'Mussarela', preco: 40 },
 *     { nome: 'Á moda', preco: 0 },
 *     { nome: 'Calabresa', preco: 40 },
 *   ])
 *   // → [Á moda (grátis), Calabresa, Mussarela]
 */
export function ordenarComplementos<T extends { nome?: string; preco?: number | string }>(
  complementos: T[]
): T[] {
  return [...complementos].sort((a, b) => {
    const precoA = Number(a.preco || 0)
    const precoB = Number(b.preco || 0)

    // 1. Grátis (preço 0) sempre no topo
    if (precoA === 0 && precoB !== 0) return -1
    if (precoB === 0 && precoA !== 0) return 1

    // 2. Se ambos grátis ou ambos pagos → alfabético (com acento)
    const nomeA = (a.nome || '').toLocaleLowerCase('pt-BR')
    const nomeB = (b.nome || '').toLocaleLowerCase('pt-BR')
    return nomeA.localeCompare(nomeB, 'pt-BR')
  })
}
