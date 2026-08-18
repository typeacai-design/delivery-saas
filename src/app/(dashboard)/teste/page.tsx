import { Suspense } from 'react'
import { notFound } from 'next/navigation'

async function TestContent() {
  let debug: any = {}

  try {
    // Chama a API via fetch do server-side
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    debug = {
      tipo: 'server-side',
      sessionExiste: !!session,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
    }
  } catch (err: any) {
    debug = { tipo: 'erro', erro: err.message }
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial', background: '#000', color: '#0f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>🔐 Teste de Sessão (Server-Side)</h1>
      <pre style={{ background: '#111', padding: 20, borderRadius: 8, overflow: 'auto' }}>
        {JSON.stringify(debug, null, 2)}
      </pre>
      <div style={{ marginTop: 20 }}>
        {debug.sessionExiste ? (
          <p style={{ color: '#0f0', fontSize: 18 }}>✅ SESSÃO EXISTE!</p>
        ) : (
          <p style={{ color: '#f00', fontSize: 18 }}>❌ SEM SESSÃO</p>
        )}
      </div>
    </div>
  )
}

export default function TestPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <Suspense fallback={<div style={{ padding: 40, background: '#000', color: '#fff' }}>Carregando...</div>}>
      <TestContent />
    </Suspense>
  )
}
