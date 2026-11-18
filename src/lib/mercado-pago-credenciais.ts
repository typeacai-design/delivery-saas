import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { billingClient } from './assinaturas-server'

type Dados = { accessToken: string; webhookSecret: string }
type Conexao = Dados & { contaId: string | null; atualizadaEm: string | null; webhookValidado: boolean }

function chave() {
  const valor = process.env.BILLING_CREDENTIALS_KEY || ''
  if (!/^[0-9a-f]{64}$/i.test(valor)) throw Error('chave_de_credenciais_indisponivel')
  return Buffer.from(valor, 'hex')
}

export function criptografarCredenciais(dados: Dados) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', chave(), iv)
  const corpo = Buffer.concat([cipher.update(JSON.stringify(dados), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), corpo].map(item => item.toString('base64url')).join('.')
}

function decifrarCredenciais(valor: string): Dados {
  const [iv, tag, corpo] = valor.split('.').map(item => Buffer.from(item, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', chave(), iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(corpo), decipher.final()]).toString('utf8'))
}

export async function lerConexaoMercadoPago(): Promise<Conexao | null> {
  const { data, error } = await billingClient().from('conexao_mercado_pago')
    .select('credenciais_cifradas,conta_id,atualizada_em,webhook_validado_em').eq('id', 1).maybeSingle()
  if (error) throw Error('conexao_mercado_pago_indisponivel')
  if (data) return {
    ...decifrarCredenciais(data.credenciais_cifradas), contaId: data.conta_id,
    atualizadaEm: data.atualizada_em, webhookValidado: Boolean(data.webhook_validado_em),
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  return accessToken && webhookSecret
    ? { accessToken, webhookSecret, contaId: null, atualizadaEm: null, webhookValidado: true }
    : null
}

export async function confirmarWebhookMercadoPago(atualizadaEm: string) {
  const { error } = await billingClient().from('conexao_mercado_pago')
    .update({ webhook_validado_em: new Date().toISOString() }).eq('id', 1)
    .eq('atualizada_em', atualizadaEm).is('webhook_validado_em', null)
  if (error) throw Error('registro_webhook_indisponivel')
}
