import { formatCurrency } from '@/lib/utils'
import { flavorLabel } from '@/lib/flavor-pricing'

export interface ItemPedido {
  nome: string
  quantidade: number
  valor_unitario: number
  variante_nome?: string
  complementos?: { nome: string; quantidade: number; valor: number; tipo?: string; regra_preco?: string; fracao_denominador?: number }[]
  observacao?: string
}

export interface DadosPedido {
  pedidoId: string
  pedidoCodigo?: string // codigo formatado (00001/26)
  tenantSlug?: string // slug do tenant para montar link do cardápio público
  tenantNome: string
  clienteNome: string
  clienteWhatsapp: string
  itens: ItemPedido[]
  subtotal: number
  taxaEntrega: number
  desconto: number
  total: number
  formaPagamento: string
  trocoPara?: number
  endereco: string
  numero: string
  complemento?: string
  bairro: string
  observacoes?: string
  tipoEntrega: 'delivery' | 'retirada'
  agendamentoPara?: string
}

/**
 * Normaliza o campo forma_pagamento do banco (array de strings ou string única)
 * para uma string legível usada tanto no card quanto no WhatsApp.
 *
 * Ex: ["pix"]        -> "pix"
 *     ["dinheiro"]   -> "dinheiro"
 *     "dinheiro"     -> "dinheiro"
 *     ["pix","dinheiro"] -> "pix + dinheiro"
 *     null/undefined -> "—"
 */
export function normalizarFormaPagamento(forma: any): string {
  if (!forma) return '—'
  if (Array.isArray(forma)) {
    const vals = forma.filter(f => f && typeof f === 'string' && f.trim())
    if (vals.length === 0) return '—'
    return vals.join(' + ')
  }
  if (typeof forma === 'string') return forma
  return '—'
}

/**
 * Formata para exibição visual no card (com capitalização).
 * Retorna "—" se vazio para evitar mostrar nada.
 */
export function formatarFormaPagamentoDisplay(forma: any): string {
  const s = normalizarFormaPagamento(forma)
  if (s === '—') return s
  // Capitaliza a primeira letra: "pix" -> "Pix", "dinheiro" -> "Dinheiro"
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function gerarMensagemWhatsApp(d: DadosPedido): string {
  // Usar codigo formatado (00001/26) ao inves de UUID
  const codigoExibir = d.pedidoCodigo || `#${d.pedidoId.slice(-6)}`
  // Link aponta para /pedido/[codigo] - rota dedicada que funciona SEM precisar de
  // localStorage/token (util quando cliente abre link no WhatsApp Web no celular)
  // Usa traco (-) no lugar de barra (/) para evitar problemas de roteamento
  const codigoParaUrl = (d.pedidoCodigo || d.pedidoId).replace(/\//g, '-')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wedelivery.site'
  const linkPedido = `${baseUrl}/pedido/${codigoParaUrl}`

  let texto = `🛒 *PEDIDO - ${d.tenantNome}*\n`
  texto += `📋 *#${codigoExibir}*\n`
  texto += `\n`

  texto += `👤 *Cliente:* ${d.clienteNome}\n`
  if (d.clienteWhatsapp) texto += `📱 *WhatsApp:* ${d.clienteWhatsapp}\n`
  texto += `\n`

  texto += `*ITENS DO PEDIDO*\n`
  texto += `─────────────────────\n`

  d.itens.forEach((item, i) => {
    const subtotal = (item.valor_unitario + (item.complementos?.reduce((s, c) => s + c.valor * c.quantidade, 0) || 0)) * item.quantidade
    texto += `*${i + 1}. ${item.nome}*${item.variante_nome ? ` (${item.variante_nome})` : ''}\n`
    texto += `   ${item.quantidade}x ${formatCurrency(subtotal / item.quantidade)} = ${formatCurrency(subtotal)}\n`
    if (item.complementos && item.complementos.length > 0) {
      texto += item.complementos.some(c => c.tipo === 'sabor') ? `   Sabores e adicionais:\n` : `   Adicionais:\n`
      item.complementos.forEach(c => {
        if (c.tipo === 'sabor') {
          texto += `   • ${flavorLabel(c)}\n`
          return
        }
        const precoAdic = c.valor * c.quantidade
        // Mostra preco apenas se for maior que zero
        // Se for gratis, nao mostra nada (fica subentendido)
        if (precoAdic > 0) {
          texto += `   • ${c.quantidade}x ${c.nome} (+${formatCurrency(precoAdic)})\n`
        } else {
          texto += `   • ${c.quantidade}x ${c.nome}\n`
        }
      })
    }
    if (item.observacao) texto += `   📝 _${item.observacao}_\n`
    texto += `\n`
  })

  texto += `─────────────────────\n`
  texto += `*Subtotal:* ${formatCurrency(d.subtotal)}\n`
  if (d.taxaEntrega > 0) texto += `*Taxa entrega:* ${formatCurrency(d.taxaEntrega)}\n`
  if (d.desconto > 0) texto += `*Desconto:* -${formatCurrency(d.desconto)}\n`
  texto += `*TOTAL:* ${formatCurrency(d.total)} 💰\n`
  texto += `\n`

  texto += `*${d.tipoEntrega === 'delivery' ? '🚗 ENTREGA' : '🏪 RETIRADA NO BALCÃO'}*\n`
  if (d.tipoEntrega === 'delivery') {
    texto += `📍 *Endereço:*\n`
    texto += `${d.endereco}${d.numero ? `, ${d.numero}` : ''}${d.complemento ? ` - ${d.complemento}` : ''}\n`
    texto += `Bairro: ${d.bairro}\n`
  }
  texto += `\n`

  texto += `💳 *Pagamento:* ${d.formaPagamento}\n`
  if ((d.formaPagamento || '').toLowerCase().includes('dinheiro') && d.trocoPara) {
    const troco = d.trocoPara - d.total
    texto += `💵 *Troco para:* ${formatCurrency(d.trocoPara)} (volta: ${formatCurrency(Math.max(0, troco))})\n`
  }
  texto += `\n`

  if (d.agendamentoPara) {
    texto += `⏰ *Agendado para:* ${new Date(d.agendamentoPara).toLocaleString('pt-BR')}\n\n`
  }

  if (d.observacoes) {
    texto += `📝 *Observações:* ${d.observacoes}\n\n`
  }

  texto += `─────────────────────\n`
  texto += `Acompanhe seu pedido: ${linkPedido}`

  return texto
}

export function gerarMensagemAvaliacao(d: { tenantNome: string; codigo: string; linkAvaliacao: string }): string {
  return `🎉 Olá! Seu pedido #${d.codigo} da ${d.tenantNome} foi entregue!

Como foi sua experiência? Sua opinião é muito importante para nós! ⭐

${d.linkAvaliacao}

Leva apenas 30 segundos! Sua avaliação nos ajuda a melhorar. 😊`
}
