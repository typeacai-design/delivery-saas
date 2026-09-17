'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserCircle2, Loader2, LogIn } from 'lucide-react'

export default function AcessoPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Verifica se há sessão de funcionário ativa
  useEffect(() => {
    const membroStr = localStorage.getItem('membro_equipe')
    if (membroStr) {
      try {
        const m = JSON.parse(membroStr)
        if (m?.perfil === 'attendant' || m?.role === 'attendant') {
          router.push('/acesso/atendimento')
          return
        }
        if (m?.perfil === 'cozinha' || m?.role === 'kitchen') {
          router.push('/acesso/cozinha')
          return
        }
        if (m?.perfil === 'motoboy' || m?.role === 'motoboy') {
          router.push('/acesso/motoboy')
          return
        }
      } catch { /* ignora */ }
    }
    setReady(true)
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const normalizedUsername = username.toLowerCase().trim()

      let data
      // Tenta primeiro via endpoint principal de login de funcionário
      try {
        const r = await fetch('/api/auth/atendente-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: normalizedUsername,
            senha: password,
          }),
        })
        data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Falha no login')
      } catch (e1: any) {
        // Fallback: tenta login via membros-equipe
        try {
          const r2 = await fetch('/api/membros-equipe/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: normalizedUsername,
              senha: password,
            }),
          })
          data = await r2.json()
          if (!r2.ok) throw new Error(data.error || 'Falha no login')
        } catch (e2: any) {
          throw new Error(e2.message || e1.message)
        }
      }

      // Seta sessão no client Supabase (se vier do endpoint principal)
      if (data.session?.access_token) {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { error: setErr } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (setErr) throw new Error('Erro ao iniciar sessão: ' + setErr.message)
      }

      const membro = data.membro
      // Salva membro no localStorage
      localStorage.setItem('membro_equipe', JSON.stringify(membro))
      // Cookie com role canônica para o middleware identificar o perfil operacional
      document.cookie = `wd_employee_role=${membro.role || membro.perfil}; path=/; max-age=${60 * 60 * 24}; samesite=lax`

      // Usa o destino retornado pelo endpoint
      const destino = data.destino
      router.push(destino)
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
      setSaving(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Loader2 className="animate-spin text-green-600" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <UserCircle2 className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Acesso ao Atendimento</h1>
          <p className="text-sm text-gray-500 mt-1">Acesse a aba de pedidos com seu usuário e senha</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-lg"
              placeholder="seu_usuario"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-lg"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
            {saving ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Solicite seu acesso ao administrador da loja
          </p>
        </div>
      </div>
    </div>
  )
}
