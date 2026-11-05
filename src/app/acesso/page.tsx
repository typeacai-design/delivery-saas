'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AcessoPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submit iniciado')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/atendente-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.toLowerCase().trim(), senha: password }),
      })
      console.log('Resposta:', res.status)
      const data = await res.json()
      console.log('Data:', data)

      if (!res.ok) throw new Error(data.error || 'Erro no login')

      localStorage.setItem('membro_equipe', JSON.stringify(data.membro))
      document.cookie = `wd_employee_role=${data.membro.role || data.membro.perfil}; path=/; max-age=${60 * 60 * 24}`

      // Aplica a sessão do Supabase no client. Sem isso, o browser não tem
      // cookie de autenticação e o EmployeeLayout server-side redireciona
      // de volta para /acesso — sintoma: "clica em entrar e volta pro login".
      if (data.session?.access_token && data.session?.refresh_token) {
        const supabase = createClient()
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (sessionError) {
          console.error('Erro ao aplicar sessão:', sessionError)
          throw new Error('Sessão não pôde ser aplicada: ' + sessionError.message)
        }
      }

      window.location.href = data.destino
    } catch (err: any) {
      console.error('Erro:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px', color: '#1f2937' }}>
          Acesso ao Atendimento
        </h1>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
          Entre com seu usuário e senha
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '16px', textAlign: 'center' }}
              placeholder="usuario"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '16px', textAlign: 'center' }}
              placeholder="senha"
            />
          </div>

          {error && (
            <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '24px' }}>
          Solicite acesso ao administrador
        </p>
      </div>
    </main>
  )
}
