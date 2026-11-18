import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'
import { billingClient } from '@/lib/assinaturas-server'
import { identificarContaMercadoPago } from '@/lib/mercado-pago-assinaturas'
import { criptografarCredenciais, lerConexaoMercadoPago } from '@/lib/mercado-pago-credenciais'

const headers = { 'Cache-Control': 'private, no-store' }
const falha = 'Não foi possível salvar ou consultar a conexão. Tente novamente.'

export async function GET() {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const conexao = await lerConexaoMercadoPago()
    return Response.json({
      conectado: Boolean(conexao), webhookValidado: conexao?.webhookValidado ?? false,
      contaId: conexao?.contaId ?? null,
    }, { headers })
  } catch {
    return Response.json({ error: falha }, { headers, status: 503 })
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  if (request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return Response.json({ error: 'Solicitação inválida.' }, { headers, status: 403 })
  }
  const body = await request.json().catch(() => null)
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : ''
  const webhookSecret = typeof body?.webhookSecret === 'string' ? body.webhookSecret.trim() : ''
  if (!/^APP_USR-[A-Za-z0-9_-]{10,500}$/.test(accessToken) || !/^[A-Za-z0-9_+=/-]{16,256}$/.test(webhookSecret)) {
    return Response.json({ error: 'Confira o Access Token de produção e a assinatura secreta do webhook.' }, { headers, status: 400 })
  }

  let contaId: string
  try {
    contaId = await identificarContaMercadoPago(accessToken)
  } catch (e) {
    const negado = e instanceof Error && /^mercado_pago_http_(400|401|403)$/.test(e.message)
    return Response.json({
      error: negado ? 'O Mercado Pago recusou o Access Token. Confira a credencial de produção.' : 'Não foi possível validar a conta no Mercado Pago.',
    }, { headers, status: negado ? 422 : 503 })
  }

  try {
    const admin = billingClient()
    const { data: existente, error } = await admin.from('conexao_mercado_pago')
      .select('conta_id,atualizada_em').eq('id', 1).maybeSingle()
    if (error) throw error
    if (existente && existente.conta_id !== contaId) {
      return Response.json({ error: 'Use credenciais da conta já vinculada para preservar a confirmação dos pagamentos.' }, { headers, status: 409 })
    }
    const valores = {
      conta_id: contaId, credenciais_cifradas: criptografarCredenciais({ accessToken, webhookSecret }),
      atualizada_em: new Date().toISOString(), webhook_validado_em: null,
    }
    const resultado = existente
      ? await admin.from('conexao_mercado_pago').update(valores).eq('id', 1)
        .eq('atualizada_em', existente.atualizada_em).select('id').maybeSingle()
      : await admin.from('conexao_mercado_pago').insert({ id: 1, ...valores }).select('id').maybeSingle()
    if (resultado.error) throw resultado.error
    if (!resultado.data) return Response.json({ error: 'A configuração mudou. Atualize a tela e tente novamente.' }, { headers, status: 409 })
    return Response.json({ conectado: true, webhookValidado: false, contaId }, { headers })
  } catch {
    return Response.json({ error: falha }, { headers, status: 503 })
  }
}
