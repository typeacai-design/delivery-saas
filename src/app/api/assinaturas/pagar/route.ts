import { FINANCEIRO_FATURAS } from '@/lib/assinaturas'
import { billingClient } from '@/lib/assinaturas-server'
import { checkoutValido } from '@/lib/mercado-pago-assinaturas'
import { authenticatedTenant, MANAGEMENT_ROLES, tenantAuthStatus } from '@/lib/tenant-auth'

export async function GET(request: Request) {
  const auth = await authenticatedTenant(MANAGEMENT_ROLES)
  if (!auth.tenantId) return Response.json({ error: 'Acesso indisponível.' }, { status: tenantAuthStatus(auth) ?? 403 })
  const url = new URL(request.url)
  const id = url.searchParams.get('id') || ''
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: 'Fatura inválida.' }, { status: 400 })
  }

  const { data, error } = await billingClient().from('faturas_assinatura').select('checkout_url,pago_em')
    .eq('tenant_id', auth.tenantId).eq('id', id).maybeSingle()
  if (error) return Response.json({ error: 'Não foi possível consultar a fatura.' }, { status: 500 })
  if (!data || !checkoutValido(data.checkout_url)) return Response.json({ error: 'Fatura indisponível.' }, { status: 404 })
  const destino = data.pago_em ? new URL(FINANCEIRO_FATURAS, url).href : data.checkout_url
  return new Response(null, { status: 303, headers: { Location: destino, 'Cache-Control': 'private, no-store' } })
}
