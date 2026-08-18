import { formatCurrency } from '@/lib/utils'

export interface ItemPedido {
  nome: string
  quantidade: number
  valor_unitario: number
  variante_nome?: string
  complementos?: { nome: string; quantidade: number; valor: number }[]
  observacao?: string
}

export interface DadosPedido {
  pedidoId: string
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

export function gerarMensagemWhatsApp(d: DadosPedido): string {
  let texto = `🛒 *PEDIDO - ${d.tenantNome}*\n`
  texto += `📋 *#${d.pedidoId.slice(-6)}*\n`
  texto += `\n`

  texto += `👤 *Cliente:* ${d.clienteNome}\n`
  if (d.clienteWhatsapp) texto += `📱 *WhatsApp:* ${d.clienteWhatsapp}\n`
  texto += `\n`

  texto += `*ITENS DO PEDIDO*\n`
  texto += `─────────────────────\n`

  d.itens.forEach((item, i) => {
    const subtotal = (item.valor_unitario + (item.complementos?.reduce((s, c) => s + c.valor * c.quantidade, 0) || 0)) * item.quantidade
    texto += `*${i + 1}. ${item.nome}*${item.variante_nome ? ` (${item.variante_nome})` : ''}\n`
    texto += `   ${item.quantidade}x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(subtotal)}\n`
    if (item.complementos && item.complementos.length > 0) {
      texto += `   Adicionais:\n`
      item.complementos.forEach(c => {
        texto += `   • ${c.quantidade}x ${c.nome}\n`
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
  if (d.formaPagamento.toLowerCase().includes('dinheiro') && d.trocoPara) {
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
  texto += `Acompanhe seu pedido: ${process.env.NEXT_PUBLIC_BASE_URL || 'https://wedelivery.site'}/pedido/${d.pedidoId}`

  return texto
}
