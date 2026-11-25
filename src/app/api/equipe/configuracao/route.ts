import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { adminEquipe, respostaEquipe } from '@/lib/equipe-server'
import { MODOS_DISTRIBUICAO, distribuirAutomatico, modoDistribuicao, type ModoDistribuicao } from '@/lib/entregas'

/** Como as entregas prontas chegam aos motoboys: eles escolhem, o lojista escolhe ou automático. */
export async function GET() {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respostaEquipe({ error: 'Sem permissão' }, status)
  const { data } = await adminEquipe().from('tenants').select('config').eq('id', auth.tenantId).single()
  return respostaEquipe({ distribuicao: modoDistribuicao(data?.config) })
}

export async function POST(request: Request) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respostaEquipe({ error: 'Sem permissão' }, status)
  const body = await request.json().catch(() => null) as { distribuicao?: unknown } | null
  if (!MODOS_DISTRIBUICAO.includes(body?.distribuicao as ModoDistribuicao)) return respostaEquipe({ error: 'Opção inválida' }, 400)
  const admin = adminEquipe()
  const { data: tenant } = await admin.from('tenants').select('config').eq('id', auth.tenantId).single()
  const config = { ...((tenant?.config as Record<string, unknown>) || {}), entrega_distribuicao: body!.distribuicao }
  const { error } = await admin.from('tenants').update({ config }).eq('id', auth.tenantId)
  if (error) return respostaEquipe({ error: 'Não foi possível salvar' }, 500)
  if (body!.distribuicao === 'automatico') await distribuirAutomatico(admin, auth.tenantId!)
  return respostaEquipe({ distribuicao: body!.distribuicao })
}
