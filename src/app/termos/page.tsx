import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function TermosPage() {
  const supabase = await createClient()
  const { data: pagina } = await supabase
    .from('saas_paginas')
    .select('*')
    .eq('slug', 'termos')
    .single()

  if (!pagina) notFound()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: pagina.conteudo_html }}
        />
      </div>
    </div>
  )
}
