import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { MANAGEMENT_ROLES, authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
import { hashAccessToken } from '@/lib/customer-identity'
import { createClient } from '@supabase/supabase-js'

const out = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  const status = tenantAuthStatus(auth)
  if (status) return out({ error: status === 401 ? 'Não autenticado' : 'Sem permissão' }, status)

  const { id } = await params
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const tokenHash = hashAccessToken(token)

  // Usa service_role para garantir que o UPDATE funcione sem RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // Verifica se o pedido existe e pertence ao tenant
  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from('pedidos')
    .select('id, status, tenant_id')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId!)
    .maybeSingle()

  if (pedidoError) {
    console.error('[avaliacao-convite] Erro ao buscar pedido:', pedidoError)
    return out({ error: 'Erro ao buscar pedido: ' + pedidoError.message }, 500)
  }

  if (!pedido) {
    return out({ error: 'Pedido não encontrado ou não pertence a este tenant' }, 404)
  }

  if (pedido.status !== 'entregue') {
    return out({ error: 'O pedido precisa estar com status "entregue" para gerar o convite de avaliação' }, 400)
  }

  // Atualiza o token de avaliação
  const { data, error } = await supabaseAdmin
    .from('pedidos')
    .update({
      avaliacao_token_hash: tokenHash,
      avaliacao_token_expires_at: expiresAt,
      avaliacao_token_used_at: null,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[avaliacao-convite] Erro ao atualizar pedido:', error)
    return out({ error: 'Não foi possível gerar o convite: ' + error.message }, 500)
  }

  if (!data) {
    return out({ error: 'Pedido não encontrado após atualização' }, 404)
  }

  return out({ token, expires_at: expiresAt })
}
