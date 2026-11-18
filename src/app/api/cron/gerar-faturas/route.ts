import { timingSafeEqual } from 'node:crypto'
import { dataBrasilia, mesAnterior, type Fatura } from '@/lib/assinaturas'
import { billingClient, camposFatura } from '@/lib/assinaturas-server'
import { criarPreferencia } from '@/lib/mercado-pago-assinaturas'

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ configurado: false })
  const recebido = Buffer.from(request.headers.get('authorization') || '')
  const esperado = Buffer.from(`Bearer ${secret}`)
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const primeiroMes = process.env.ASSINATURAS_PRIMEIRA_COMPETENCIA
  if (!primeiroMes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(primeiroMes)
    || !process.env.MERCADO_PAGO_ACCESS_TOKEN || !process.env.MERCADO_PAGO_WEBHOOK_SECRET) {
    return Response.json({ configurado: false })
  }

  const hoje = dataBrasilia()
  const dia = Number(hoje.slice(8))
  const competencia = mesAnterior(hoje)
  if (dia < 5 || dia > 10 || competencia.slice(0, 7) < primeiroMes) return Response.json({ emitidas: 0 })

  const admin = billingClient()
  const { error: erroGeracao } = await admin.rpc('gerar_faturas_assinatura', { p_competencia: competencia })
  if (erroGeracao) return Response.json({ error: 'Não foi possível gerar as faturas.' }, { status: 500 })

  const expiracaoReserva = new Date(Date.now() - 15 * 60_000).toISOString()
  const disponiveis = `checkout_reservado_em.is.null,checkout_reservado_em.lt.${expiracaoReserva}`
  const { data: pendentes, error: erroLista } = await admin.from('faturas_assinatura').select(camposFatura)
    .eq('competencia', competencia).is('checkout_url', null).or(disponiveis)
    .order('id').limit(100).returns<Fatura[]>()
  if (erroLista) return Response.json({ error: 'Não foi possível consultar as faturas.' }, { status: 500 })

  let emitidas = 0
  let falhas = 0
  const inicio = Date.now()
  for (let i = 0; i < pendentes.length && Date.now() - inicio < 42_000; i += 5) {
    await Promise.all(pendentes.slice(i, i + 5).map(async fatura => {
      try {
        const reserva = new Date().toISOString()
        const { data: reservada, error: erroReserva } = await admin.from('faturas_assinatura')
          .update({ checkout_reservado_em: reserva }).eq('id', fatura.id).is('checkout_url', null)
          .or(disponiveis).select('id').maybeSingle()
        if (erroReserva) throw erroReserva
        if (!reservada) return
        const checkout = await criarPreferencia(fatura)
        const { data: publicada, error } = await admin.from('faturas_assinatura')
          .update({ mp_preferencia_id: checkout.id, checkout_url: checkout.url, checkout_reservado_em: null })
          .eq('id', fatura.id).eq('checkout_reservado_em', reserva).is('checkout_url', null).select('id').maybeSingle()
        if (error || !publicada) throw Error('fatura_nao_publicada')
        emitidas++
      } catch (error) {
        falhas++
        console.error('assinatura_emissao_falhou', fatura.id, error instanceof Error ? error.message : '')
      }
    }))
  }

  return Response.json({ competencia, emitidas, falhas }, { status: falhas ? 502 : 200 })
}
