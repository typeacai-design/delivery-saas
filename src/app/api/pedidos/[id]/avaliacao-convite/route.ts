import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { hashAccessToken } from '@/lib/customer-identity'

const out = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return out({ error: status === 401 ? 'Não autenticado' : 'Sem permissão' }, status)
  const { id } = await params
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await auth.supabase.from('pedidos').update({ avaliacao_token_hash: hashAccessToken(token), avaliacao_token_expires_at: expiresAt, avaliacao_token_used_at: null }).eq('id', id).eq('tenant_id', auth.tenantId).eq('status', 'entregue').select('id').maybeSingle()
  if (error) return out({ error: 'Não foi possível gerar o convite' }, 500)
  if (!data) return out({ error: 'Pedido entregue não encontrado' }, 404)
  return out({ token, expires_at: expiresAt })
}