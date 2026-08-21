'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DiagnosticoPerfilPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const log = (msg: string) => setLogs(prev => [...prev, `${new Date().toISOString().substr(11, 8)} - ${msg}`])

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      log('1. Verificando usuário logado...')
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      log(`   User: ${userData?.user?.id} (erro: ${userErr?.message || 'nenhum'})`)

      if (!userData.user) {
        setError('Não está logado')
        return
      }

      log('2. Buscando tenant via API /api/auth/meu-tenant...')
      try {
        const r = await fetch('/api/auth/meu-tenant')
        log(`   Status: ${r.status}`)
        const body = await r.json()
        log(`   Body: ${JSON.stringify(body).substr(0, 500)}`)
        if (r.ok) setData(body)
        else setError(body.error || 'Erro desconhecido')
      } catch (e: any) {
        log(`   Erro: ${e.message}`)
        setError(e.message)
      }

      log('3. Buscando diretamente via client-side...')
      try {
        const { data: t, error: tErr } = await supabase
          .from('tenants')
          .select('*')
          .single()
        log(`   Tenant: ${t?.nome} (erro: ${tErr?.message || 'nenhum'})`)
        if (!data && t) setData(t)
      } catch (e: any) {
        log(`   Erro: ${e.message}`)
      }

      log('4. Verificando activeTenantId...')
      try {
        const r = await fetch('/api/auth/session')
        const body = await r.json()
        log(`   Tenant da session: ${body?.tenant?.id} / ${body?.tenant?.nome}`)
      } catch (e: any) {
        log(`   Erro: ${e.message}`)
      }
    }
    run()
  }, [])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Diagnóstico do Perfil</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-bold text-red-700">❌ ERRO: {error}</p>
        </div>
      )}

      {data && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="font-bold text-green-700 mb-2">✅ TENANT CARREGADO:</p>
          <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-gray-50 border rounded-xl p-4">
        <h2 className="font-bold mb-2">📋 Logs de execução:</h2>
        <pre className="text-xs space-y-1 overflow-x-auto">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </pre>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>📝 Abra o Console do navegador (F12) para ver mais detalhes.</p>
        <p>🔄 Se precisar rodar de novo, recarregue a página (F5).</p>
      </div>
    </div>
  )
}