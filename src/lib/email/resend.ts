// Wrapper do Resend para envio de emails transacionais
// Documentação: https://resend.com/docs

import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@wedelivery.site'

export const resend = apiKey ? new Resend(apiKey) : null

export async function enviarEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  if (!resend) {
    console.warn('Resend não configurado (RESEND_API_KEY ausente)')
    return { success: false, error: 'Resend não configurado' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    })
    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    console.error('Erro ao enviar email:', error)
    return { success: false, error: error.message }
  }
}

export function templateConfirmacaoPedido({ tenantNome, pedidoId, clienteNome, valorTotal, link }: any) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #16A34A;">Novo pedido recebido!</h1>
      <p>Olá, <strong>${tenantNome}</strong>!</p>
      <p>Você recebeu um novo pedido:</p>
      <div style="background: #F0FDF4; padding: 16px; border-radius: 12px; margin: 16px 0;">
        <p><strong>Pedido:</strong> #${pedidoId.slice(-6)}</p>
        <p><strong>Cliente:</strong> ${clienteNome}</p>
        <p><strong>Total:</strong> R$ ${valorTotal.toFixed(2)}</p>
      </div>
      <p><a href="${link}" style="background: #16A34A; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none;">Ver pedido</a></p>
    </div>
  `
}

export function templateBoasVindas({ tenantNome, linkLogin }: any) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #16A34A;">Bem-vindo ao We Delivery!</h1>
      <p>Olá, <strong>${tenantNome}</strong>!</p>
      <p>Seu cadastro foi aprovado. Agora você pode acessar o painel e configurar sua loja.</p>
      <p><a href="${linkLogin}" style="background: #16A34A; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none;">Acessar painel</a></p>
    </div>
  `
}
