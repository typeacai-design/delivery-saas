import { authenticatedTenant, MANAGEMENT_ROLES, tenantAuthStatus } from '@/lib/tenant-auth'
import { faturasDoLojista } from '@/lib/assinaturas-server'
import { situacaoFatura } from '@/lib/assinaturas'

export async function GET() {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  if (!auth.tenantId) return Response.json({ error: 'Acesso indisponível.' }, { status: tenantAuthStatus(auth) ?? 403 })
  try {
    const faturas = (await faturasDoLojista(auth.tenantId)).map(fatura => ({
      id: fatura.id,
      competencia: fatura.competencia,
      vencimento: fatura.vencimento,
      valor_centavos: fatura.valor_centavos,
      situacao: situacaoFatura(fatura),
    }))
    return Response.json({ faturas }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Não foi possível carregar as faturas.' }, { status: 500 })
  }
}
