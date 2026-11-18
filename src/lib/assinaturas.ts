export const FINANCEIRO_FATURAS = '/financeiro?aba=contas'
export const PEDIDOS_BLOQUEADOS = 'Os pedidos estão bloqueados até a confirmação do pagamento da assinatura.'
export const CARDAPIO_BLOQUEADO = 'Esta loja não pode receber pedidos no momento. Entre em contato via WhatsApp.'

const calendario = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})
const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })

export function dataBrasilia(now = new Date()) {
  return calendario.format(now)
}

export function mesAnterior(hoje: string) {
  const [ano, mes] = hoje.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10)
}

export function nomeCompetencia(competencia: string) {
  return `${nomeMes.format(new Date(`${competencia}T12:00:00Z`))} de ${competencia.slice(0, 4)}`
}

export function dataFatura(data: string) {
  return data.split('-').reverse().join('/')
}

export type Fatura = {
  id: string
  tenant_id: string | null
  loja_nome: string
  competencia: string
  faturamento_centavos: number
  valor_centavos: number
  vencimento: string
  pago_em: string | null
  checkout_url: string | null
}

export type SituacaoFatura = 'Aguardando emissão' | 'Aguardando pagamento' | 'Vencida' | 'Paga'

export function situacaoFatura(fatura: Fatura, hoje = dataBrasilia()): SituacaoFatura {
  if (fatura.pago_em) return 'Paga'
  if (!fatura.checkout_url) return 'Aguardando emissão'
  return fatura.vencimento < hoje ? 'Vencida' : 'Aguardando pagamento'
}
