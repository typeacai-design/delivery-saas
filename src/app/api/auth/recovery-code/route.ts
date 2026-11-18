import { createClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { rateLimited, rateLimitedByKey } from '@/lib/customer-identity'
import { enviarEmail } from '@/lib/email/resend'

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return Response.json({ error: 'Formato inválido.' }, { status: 415 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey || !process.env.RESEND_API_KEY) {
    return Response.json({ error: 'A recuperação está indisponível no momento.' }, { status: 503 })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  if (await rateLimited(admin, request, 'password-recovery-ip', 5)) {
    return Response.json({ error: 'Aguarde um minuto antes de tentar novamente.' }, { status: 429 })
  }

  // Return the same response before looking up the account or contacting the email provider.
  after(async () => {
    try {
      if (await rateLimitedByKey(admin, `password-recovery-email:${email}`, 1)) return

      const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
      if (error) {
        if (error.code !== 'user_not_found') console.error('password_recovery_generate_failed', error.code)
        return
      }

      const token = data.properties?.email_otp
      if (!data.user || !token || !/^\d{6,10}$/.test(token)) return
      const { data: memberships, error: membershipError } = await admin
        .from('usuarios_loja')
        .select('user_id')
        .eq('user_id', data.user.id)
        .eq('ativo', true)
        .limit(1)
      if (membershipError) {
        console.error('password_recovery_membership_failed', membershipError.code)
        return
      }
      if (!memberships?.length) return

      await enviarEmail({
        to: email,
        subject: 'We Delivery | Código de recuperação de senha',
        text: `Seu código para recuperar a senha do We Delivery é ${token}. Digite-o na tela de recuperação. Se você não solicitou a troca, ignore este e-mail.`,
        html: `<p>Seu código para recuperar a senha do We Delivery:</p><p><strong>${token}</strong></p><p>Digite-o na tela de recuperação. Se você não solicitou a troca, ignore este e-mail.</p>`,
      })
    } catch {
      console.error('password_recovery_request_failed')
    }
  })

  return Response.json({ success: true }, { status: 202 })
}
