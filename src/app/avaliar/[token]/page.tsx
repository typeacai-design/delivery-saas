import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import AvaliacaoForm from '../avaliar-loja/form'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function AvaliarPorTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // Buscar dados do convite via API server-side
  // 1) Calcular hash do token para buscar no banco
  const { createHash } = await import('node:crypto')
  const tokenHash = createHash('sha256').update(token).digest('hex')

  // 2) Buscar pedido via hash do token
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, tenant_id, codigo, status, avaliacao_token_used_at')
    .eq('avaliacao_token_hash', tokenHash)
    .maybeSingle()

  if (pedidoError || !pedido) {
    notFound()
  }

  // 3) Buscar dados do tenant (lojista)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, nome, slug, logo_url, cor_principal')
    .eq('id', pedido.tenant_id)
    .single()

  if (tenantError || !tenant) {
    notFound()
  }

  return (
    <AvaliacaoForm
      tenant={tenant}
      mode="pedido"
      token={token}
      pedidoInfo={{ codigo: pedido.codigo, id: pedido.id }}
    />
  )
}
