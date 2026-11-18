import { createClient } from '@supabase/supabase-js'
import { rateLimited } from '@/lib/customer-identity'
import { enviarEmail } from '@/lib/email/resend'
import { trialLeadGoals } from '@/lib/trial-leads'

const unavailable = 'O envio está indisponível no momento. Tente novamente mais tarde.'

function field(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim()
  if (contentType !== 'application/json') {
    return Response.json({ error: 'Formato de envio inválido.' }, { status: 415 })
  }

  const body = await request.json().catch(() => null)
  const name = field(body?.name)
  const business = field(body?.business)
  const phone = field(body?.phone)
  const goal = field(body?.goal)
  const digits = phone.replace(/\D/g, '')

  if (!name || name.length > 120 || !business || business.length > 160
    || phone.length > 32 || !/^\+?[\d ().-]+$/.test(phone)
    || !/^(?:55)?\d{10,11}$/.test(digits) || !trialLeadGoals.includes(goal)) {
    return Response.json({
      error: 'Confira o nome, o negócio, o WhatsApp com DDD e a opção selecionada.',
    }, { status: 400 })
  }

  const to = process.env.TRIAL_LEADS_EMAIL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!to || !process.env.RESEND_API_KEY || !supabaseUrl || !serviceKey) {
    return Response.json({ error: unavailable }, { status: 503 })
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    if (await rateLimited(admin, request, 'landing-trial-leads', 5)) {
      return Response.json({ error: 'Aguarde um minuto antes de tentar novamente.' }, { status: 429 })
    }

    const text = [
      'Nova solicitação de teste grátis por 30 dias.',
      '',
      `Nome completo: ${name}`,
      `Nome do negócio: ${business}`,
      `WhatsApp: ${phone}`,
      `Objetivo: ${goal}`,
    ].join('\n')
    const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    const result = await enviarEmail({
      to,
      subject: 'We Delivery | Nova solicitação de teste grátis',
      text,
      html: `<p>${escaped.replaceAll('\n', '<br>')}</p>`,
    })

    if (!result.success) return Response.json({ error: unavailable }, { status: 502 })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: unavailable }, { status: 503 })
  }
}
