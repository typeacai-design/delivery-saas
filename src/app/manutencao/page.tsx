import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ManutencaoPage() {
  const supabase = await createClient()
  const { data: config } = await supabase
    .from('saas_config')
    .select('valor')
    .eq('chave', 'geral')
    .single()

  const mensagem = (config?.valor as any)?.mensagem_manutencao || 'Voltamos em breve!'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #F0FDF4, #FAFAFA)' }}>
      <div className="max-w-md text-center">
        <div className="text-7xl mb-6">🛠️</div>
        <h1 className="text-3xl font-bold mb-3">Estamos em manutenção</h1>
        <p className="text-gray-600 mb-6">{mensagem}</p>
        <div className="text-sm text-gray-500">
          A We Delivery volta já já com tudo funcionando.
        </div>
      </div>
    </div>
  )
}
