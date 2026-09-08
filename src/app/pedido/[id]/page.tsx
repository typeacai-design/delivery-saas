import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Clock, Check, Truck, X, MapPin, Phone, User, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import PedidoClienteWrapper from './wrapper'

export const dynamic = 'force-dynamic'
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
  // URL vem com %2F, decodificar
  const decodedId = decodeURIComponent(id)
  console.log('[pedido] id raw:', id, 'decoded:', decodedId)

  let pedido: any = null
  if (/^\d{5}\/\d{2}$/.test(decodedId)) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(*), tenants(nome, slug, logo_url, telefone, cor_principal)')
      .eq('codigo', decodedId)
      .maybeSingle()
    console.log('[pedido] por codigo:', decodedId, 'data:', !!data, 'error:', error?.message)
    pedido = data
  } else {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(*), tenants(nome, slug, logo_url, telefone, cor_principal)')
      .eq('id', id)
      .maybeSingle()
    console.log('[pedido] por uuid:', id, 'data:', !!data, 'error:', error?.message)
    pedido = data
  }

  if (!pedido) {
    console.log('[pedido] Nao encontrado, retornando 404. id:', decodedId)
    notFound()
  }

  // Buscar o codigo formatado
  const codigoFormatado = pedido.codigo || `#${pedido.id.slice(0, 8)}`

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
    />
  )
}
