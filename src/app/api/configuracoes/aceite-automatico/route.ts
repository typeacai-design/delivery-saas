import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, SALES_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'

const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const KEY = 'aceitar_pedidos_automaticamente'

/** Pedidos > Fluxo: "Aceitar pedidos automaticamente" (new orders skip "Novo" and start in "Preparando"). */
export async function GET() {
  const auth = await authenticatedTenant(SALES_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respond({ error: 'Sem permissão' }, status)
  const { data } = await auth.supabase.from('tenants').select('config').eq('id', auth.tenantId).maybeSingle()
  return respond({ ativo: (data?.config as Record<string, unknown> | null)?.[KEY] === true })
}

export async function POST(request: Request) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return respond({ error: 'Somente o dono ou gerente pode alterar' }, status)
  const body = await request.json().catch(() => null) as { ativo?: unknown } | null
  if (typeof body?.ativo !== 'boolean') return respond({ error: 'Dados inválidos' }, 400)
  const { data: tenant, error: readError } = await auth.supabase.from('tenants').select('config').eq('id', auth.tenantId).single()
  if (readError) return respond({ error: 'Não foi possível ler a configuração' }, 500)
  const config = { ...((tenant?.config as Record<string, unknown>) || {}), [KEY]: body.ativo }
  const { error } = await auth.supabase.from('tenants').update({ config }).eq('id', auth.tenantId)
  if (error) return respond({ error: 'Não foi possível salvar' }, 500)
  return respond({ ativo: body.ativo })
}
