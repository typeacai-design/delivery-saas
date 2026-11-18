import { FINANCEIRO_FATURAS } from '@/lib/assinaturas'

export function POST() {
  return Response.json({
    error: 'O Pix fixo de mensalidade foi encerrado. Consulte as faturas em Financeiro → Contas a pagar.',
    destino: FINANCEIRO_FATURAS,
  }, { status: 410 })
}
