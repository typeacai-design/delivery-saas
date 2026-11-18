import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'
import { dataBrasilia, situacaoFatura, type Fatura } from '@/lib/assinaturas'
import { billingClient, camposFatura } from '@/lib/assinaturas-server'

export async function GET() {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  try {
    const admin = billingClient()
    const competencia = dataBrasilia().slice(0, 7) + '-01'
    const [lojas, receita, faturas] = await Promise.all([
      admin.from('tenants').select('id,nome').order('nome'),
      admin.rpc('faturamento_assinatura', { p_competencia: competencia }),
      admin.from('faturas_assinatura').select(camposFatura).order('competencia', { ascending: false })
        .order('id').limit(100).returns<Fatura[]>(),
    ])
    if (lojas.error || receita.error || faturas.error) throw Error('consulta_de_cobrancas_falhou')
    const nomes = new Map(lojas.data.map(loja => [loja.id, loja.nome]))
    const estimativas = (receita.data as {tenant_id: string; faturamento_centavos: number; valor_centavos: number}[])
      .filter(row => row.faturamento_centavos > 0).map(row => ({
        ...row, loja: nomes.get(row.tenant_id) || 'Lojista',
      })).sort((a, b) => a.loja.localeCompare(b.loja))

    return Response.json({
      competencia,
      estimativas,
      faturas: faturas.data.map(row => ({ ...row, loja: row.loja_nome, situacao: situacaoFatura(row) })),
      integracaoConfigurada: Boolean(process.env.CRON_SECRET && process.env.ASSINATURAS_PRIMEIRA_COMPETENCIA
        && process.env.MERCADO_PAGO_ACCESS_TOKEN && process.env.MERCADO_PAGO_WEBHOOK_SECRET),
    })
  } catch {
    return Response.json({ error: 'Não foi possível carregar as cobranças.' }, { status: 500 })
  }
}
