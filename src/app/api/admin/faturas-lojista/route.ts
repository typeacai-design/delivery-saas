import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'
import { situacaoFatura, type Fatura } from '@/lib/assinaturas'
import { billingClient, camposFatura } from '@/lib/assinaturas-server'

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const headers = { 'Cache-Control': 'private, no-store' }

type FaturaComBaixa = Fatura & { baixa_manual_em: string | null }

function resumir(fatura: FaturaComBaixa) {
  return {
    id: fatura.id, competencia: fatura.competencia, valor_centavos: fatura.valor_centavos,
    vencimento: fatura.vencimento, pago_em: fatura.pago_em,
    situacao: situacaoFatura(fatura), baixaManual: Boolean(fatura.baixa_manual_em),
  }
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  const tenantId = new URL(request.url).searchParams.get('loja') || ''
  if (!uuid.test(tenantId)) return Response.json({ error: 'Lojista inválido.' }, { status: 400, headers })

  const { data, error } = await billingClient().from('faturas_assinatura')
    .select(camposFatura + ',baixa_manual_em').eq('tenant_id', tenantId).not('checkout_url', 'is', null)
    .order('pago_em', { ascending: false, nullsFirst: true }).order('competencia', { ascending: false })
    .limit(60).returns<FaturaComBaixa[]>()
  if (error) return Response.json({ error: 'Não foi possível consultar as faturas.' }, { status: 500, headers })
  return Response.json({ faturas: data.map(resumir) }, { headers })
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession()
  if (!admin) return adminUnauthorizedResponse()
  if (request.headers.get('origin') !== new URL(request.url).origin
    || request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 403, headers })
  }

  const body = await request.json().catch(() => null)
  const { loja, fatura } = body ?? {}
  if (typeof loja !== 'string' || typeof fatura !== 'string' || !uuid.test(loja) || !uuid.test(fatura)) {
    return Response.json({ error: 'Lojista ou fatura inválida.' }, { status: 400, headers })
  }

  const db = billingClient()
  const agora = new Date().toISOString()
  const campos = camposFatura + ',baixa_manual_em'
  const { data: atualizada, error } = await db.from('faturas_assinatura')
    .update({ pago_em: agora, baixa_manual_em: agora, baixa_manual_por: admin.email })
    .eq('id', fatura).eq('tenant_id', loja).is('pago_em', null).not('checkout_url', 'is', null)
    .select(campos).maybeSingle<FaturaComBaixa>()
  if (error) return Response.json({ error: 'Não foi possível registrar a baixa.' }, { status: 500, headers })
  if (atualizada) return Response.json({ fatura: resumir(atualizada), registrada: true }, { headers })

  const { data: existente, error: erroConsulta } = await db.from('faturas_assinatura').select(campos)
    .eq('id', fatura).eq('tenant_id', loja).not('checkout_url', 'is', null).maybeSingle<FaturaComBaixa>()
  if (erroConsulta) return Response.json({ error: 'Não foi possível consultar a fatura.' }, { status: 500, headers })
  if (!existente?.pago_em) return Response.json({ error: 'Fatura indisponível para baixa.' }, { status: 404, headers })
  return Response.json({ fatura: resumir(existente), registrada: false }, { headers })
}
