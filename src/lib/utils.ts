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
 * Formata o código de exibição de um pedido no padrão:
 *   5 dígitos + "/" + 2 dígitos do ano de criação do pedido
 *   Ex.: id "abcd-..." criado em 2026 → "00021/26"
 *
 * Usa o id quando não há data de criação ou quando o id é curto,
 * exibindo o id puro como fallback para evitar quebrar a UI.
 */
export function formatarCodigoPedido(id: string, createdAt?: string | null): string {
  const year = (() => {
    if (createdAt) {
      const d = new Date(createdAt)
      if (!Number.isNaN(d.getTime())) return String(d.getFullYear()).slice(-2)
    }
    return String(new Date().getFullYear()).slice(-2)
  })()

  // Gera 5 dígitos a partir do id (qualquer string → número estável de 5 dígitos)
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
