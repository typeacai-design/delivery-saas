import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const ERROS: Record<string, string> = {
  cashback_inativo: 'Ative e salve o cashback antes de aplicar o retroativo.',
  cashback_regra_invalida: 'Configure um valor de cashback maior que zero.',
  sem_permissao: 'Somente o dono ou gerente da loja pode aplicar o retroativo.',
}

/** Credits cashback for past paid orders. Safe to repeat: each order is credited at most once. */
export async function POST() {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respond({ error: status === 401 ? 'Não autenticado' : 'Sem permissão para esta loja' }, status)
  const { data, error } = await auth.supabase.rpc('aplicar_cashback_retroativo', { p_tenant_id: auth.tenantId })
  if (error) {
    const known = Object.keys(ERROS).find(key => error.message?.includes(key))
    if (!known) console.error('cashback_retroativo_failed', error.code)
    return respond({ error: known ? ERROS[known] : 'Não foi possível aplicar o retroativo' }, known ? 400 : 500)
  }
  return respond({ ok: true, ...(data as { pedidos: number; clientes: number; total: number }) })
}
