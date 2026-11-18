import { createHmac, timingSafeEqual } from 'node:crypto'
import { FINANCEIRO_FATURAS, nomeCompetencia, type Fatura } from './assinaturas'

const site = 'https://wedelivery.site'

async function mercadoPago(path: string, options: RequestInit = {}) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!token) throw Error('mercado_pago_nao_configurado')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options, headers, cache: 'no-store', signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw Error(`mercado_pago_http_${response.status}`)
  return response.json()
}

export function checkoutValido(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && [
      'www.mercadopago.com.br', 'mercadopago.com.br', 'www.mercadopago.com', 'mercadopago.com',
    ].includes(url.hostname)
  } catch {
    return false
  }
}

export async function criarPreferencia(fatura: Fatura) {
  const volta = site + FINANCEIRO_FATURAS
  const result = await mercadoPago('/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': fatura.id },
    body: JSON.stringify({
      items: [{
        id: fatura.id, title: `Assinatura We Delivery · ${nomeCompetencia(fatura.competencia)}`,
        quantity: 1, currency_id: 'BRL', unit_price: fatura.valor_centavos / 100,
      }],
      external_reference: fatura.id,
      notification_url: `${site}/api/webhooks/mercado-pago-assinaturas?source_news=webhooks`,
      back_urls: { success: volta, pending: volta, failure: volta },
      auto_return: 'approved',
    }),
  })
  if (typeof result.id !== 'string' || !checkoutValido(result.init_point)) throw Error('mercado_pago_preferencia_invalida')
  return { id: result.id, url: result.init_point }
}

export function notificacaoValida(request: Request, id: string, secret: string) {
  const requestId = request.headers.get('x-request-id')
  const signature = new Map(request.headers.get('x-signature')?.split(',').map(part => {
    const [key, value] = part.split('=')
    return [key.trim(), value?.trim()]
  }))
  const ts = signature.get('ts')
  const hash = signature.get('v1')
  if (!requestId || !ts || !/^\d{10,13}$/.test(ts) || !hash || !/^[0-9a-f]{64}$/i.test(hash)) return false
  const expected = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest()
  return timingSafeEqual(expected, Buffer.from(hash, 'hex'))
}

export function consultarPagamento(id: string) {
  return mercadoPago(`/v1/payments/${id}`)
}
