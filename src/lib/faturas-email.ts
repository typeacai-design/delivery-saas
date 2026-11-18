import { billingClient } from './assinaturas-server'
import { dataFatura, FINANCEIRO_FATURAS, nomeCompetencia } from './assinaturas'
import { enviarEmail } from './email/resend'
import { formatCurrency } from './utils'

type Aviso = {
  id: string
  competencia: string
  vencimento: string
  valor_centavos: number
  email_destino: string | null
  tenants: { email: string | null }
}
const link = 'https://wedelivery.site' + FINANCEIRO_FATURAS

export async function avisarFaturasPublicadas(admin: ReturnType<typeof billingClient>, prazo: number) {
  if (!process.env.RESEND_API_KEY || Date.now() >= prazo) return { enviados: 0, falhas: 0 }
  const expiracao = new Date(Date.now() - 15 * 60_000).toISOString()
  const disponiveis = `email_reservado_em.is.null,email_reservado_em.lt.${expiracao}`
  const { data, error } = await admin.from('faturas_assinatura')
    .select('id,competencia,vencimento,valor_centavos,email_destino,tenants!inner(email)')
    .not('checkout_url', 'is', null).is('pago_em', null).is('email_enviado_em', null)
    .not('tenants.email', 'is', null).neq('tenants.email', '').or(disponiveis)
    .order('vencimento').order('id').limit(75).returns<Aviso[]>()
  if (error) {
    console.error('faturas_email_consulta_falhou', error.code)
    return { enviados: 0, falhas: 1 }
  }

  let enviados = 0
  let falhas = 0
  for (let i = 0; i < data.length && Date.now() < prazo; i += 5) {
    await Promise.all(data.slice(i, i + 5).map(async fatura => {
      const destino = (fatura.email_destino || fatura.tenants.email || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) return
      try {
        const reserva = new Date().toISOString()
        const { data: reservado, error: erroReserva } = await admin.from('faturas_assinatura')
          .update({ email_reservado_em: reserva, email_destino: destino }).eq('id', fatura.id)
          .is('pago_em', null).is('email_enviado_em', null).or(disponiveis).select('id').maybeSingle()
        if (erroReserva) throw erroReserva
        if (!reservado) return

        const competencia = nomeCompetencia(fatura.competencia)
        const valor = formatCurrency(fatura.valor_centavos / 100)
        const vencimento = dataFatura(fatura.vencimento)
        const mensagem = `Sua fatura de ${competencia} já está disponível no We Delivery.`
        const resposta = await enviarEmail({
          to: destino,
          subject: `We Delivery | Fatura de ${competencia} disponível`,
          text: `${mensagem}\nValor: ${valor}\nVencimento: ${vencimento}\nVer fatura: ${link}`,
          html: `<p>${mensagem}</p><p><strong>Valor:</strong> ${valor}<br><strong>Vencimento:</strong> ${vencimento}</p><p><a href="${link}">Ver fatura</a></p>`,
          idempotencyKey: `fatura-disponivel/${fatura.id}`,
        })
        if (!resposta.success) throw Error('resend_falhou')

        const { error: erroBaixa } = await admin.from('faturas_assinatura')
          .update({ email_enviado_em: new Date().toISOString(), email_reservado_em: null })
          .eq('id', fatura.id).eq('email_reservado_em', reserva)
        if (erroBaixa) throw erroBaixa
        enviados++
      } catch {
        falhas++
        console.error('fatura_email_falhou', fatura.id)
      }
    }))
  }
  return { enviados, falhas }
}
