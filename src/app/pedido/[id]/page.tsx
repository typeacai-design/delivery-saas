import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Clock, Check, Truck, X, MapPin, Phone, User, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import PedidoClienteWrapper from './wrapper'

export const revalidate = 0 // Sempre dinamico

export default async function PedidoClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // Aceitar tanto o codigo formatado (00008/26) quanto o UUID
  let pedido: any = null
  if (/^\d{5}\/\d{2}$/.test(id)) {
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(*), tenants(nome, slug, logo_url, telefone, cor_principal, config)')
      .eq('codigo', id)
      .single()
    pedido = data
  } else {
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(*), tenants(nome, slug, logo_url, telefone, cor_principal, config)')
      .eq('id', id)
      .single()
    pedido = data
  }

  if (!pedido) {
    notFound()
  }

  // Buscar o codigo formatado
  const codigoFormatado = pedido.codigo || `#${pedido.id.slice(0, 8)}`

  // Extrair cores e tipografia do config do lojista
  const tenantConfig = (pedido.tenants?.config as any) || {}
  const customColors = {
    primary: tenantConfig.cardapio_cores?.primary || pedido.tenants?.cor_principal || undefined,
    secondary: tenantConfig.cardapio_cores?.secondary || undefined,
    accent: tenantConfig.cardapio_cores?.accent || pedido.tenants?.cor_principal || undefined,
  }
  const tipografia = tenantConfig.cardapio_tipografia || 'classica'

  return (
    <PedidoClienteWrapper
      codigo={codigoFormatado}
      tenantNome={pedido.tenants?.nome || 'Loja'}
      tenantSlug={pedido.tenants?.slug || ''}
      tenantTelefone={pedido.tenants?.telefone || ''}
      tenantLogo={pedido.tenants?.logo_url}
      pedidoId={pedido.id}
      initialStatus={pedido.status}
      initialData={pedido}
      customColors={customColors}
      tipografia={tipografia}
    />
  )
}
