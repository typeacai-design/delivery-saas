import { billingClient } from '@/lib/assinaturas-server'
import { consultarPagamento, notificacaoValida } from '@/lib/mercado-pago-assinaturas'

export async function POST(request: Request) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret) return new Response(null, { status: 503 })
  const id = new URL(request.url).searchParams.get('data.id') || ''
  if (!/^\d{1,30}$/.test(id) || !notificacaoValida(request, id, secret)) return new Response(null, { status: 401 })
  const evento = await request.json().catch(() => null)
  if (evento?.type !== 'payment' || String(evento.data?.id) !== id) return new Response(null, { status: 200 })

  try {
    const pagamento = await consultarPagamento(id)
    const referencia = pagamento.external_reference
    if (String(pagamento.id) !== id || pagamento.live_mode !== true || pagamento.currency_id !== 'BRL'
      || typeof referencia !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(referencia)) {
      return new Response(null, { status: 200 })
    }

    const valorCentavos = Math.round(Number(pagamento.transaction_amount) * 100)
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) return new Response(null, { status: 200 })

    const atualizado = new Date(pagamento.date_last_updated)
    if (!Number.isFinite(atualizado.getTime())) throw Error('data_pagamento_invalida')
    const aprovacao = pagamento.date_approved ? new Date(pagamento.date_approved) : atualizado
    const estornado = Number(pagamento.transaction_amount_refunded || 0) > 0
    const integral = pagamento.status === 'approved' && !estornado

    const { error } = await billingClient().rpc('conciliar_fatura_assinatura', {
      p_fatura_id: referencia,
      p_pagamento_id: id,
      p_valor_centavos: valorCentavos,
      p_atualizado_em: atualizado.toISOString(),
      p_aprovado_em: integral ? aprovacao.toISOString() : null,
    })
    if (error) throw error
    return new Response(null, { status: 200 })
  } catch {
    console.error('assinatura_webhook_falhou', id)
    return new Response(null, { status: 500 })
  }
}
