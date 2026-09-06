import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import AvaliacaoForm from '../form'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function AvaliacaoPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, nome, slug, logo_url, cor_principal')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (error || !tenant) {
    notFound()
  }

  return <AvaliacaoForm tenant={tenant} />
}
