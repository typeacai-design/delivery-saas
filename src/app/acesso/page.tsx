'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChefHat, Bike, Loader2, LogIn } from 'lucide-react'

export default function AcessoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [lojas, setLojas] = useState<any[]>([])

  useEffect(() => {
    // Verificar se já está logado
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Verificar perfil
        verificarPerfil(session.user.id)
      } else {
        setLoading(false)
        carregarLojas()
      }
    })
  }, [])

  const carregarLojas = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('tenants').select('id, nome, slug').eq('ativo', true).order('nome')
    setLojas(data || [])
  }

  const verificarPerfil = async (userId: string) => {
    const supabase = createClient()
    const { data: membro } = await supabase
      .from('membros_equipe')
      .select('id, perfil, tenants(nome)')
      .eq('user_id', userId)
      .eq('ativo', true)
      .single()

    if (membro) {
      if (membro.perfil === 'cozinha') {
        router.push('/acesso/cozinha')
      } else if (membro.perfil === 'motoboy') {
        router.push('/acesso/motoboy')
      } else {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const r = await fetch('/api/membros-equipe/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.toLowerCase().trim(),
          senha: password,
        }),
      })
      const data = await r.json()

      if (!r.ok) {
        setError(data.error || 'Usuário inválido ou não encontrado')
        setSaving(false)
        return
      }

      const membro = data.membro

      localStorage.setItem('membro_equipe', JSON.stringify({
        id: membro.id,
        nome: membro.nome,
        perfil: membro.perfil,
        tenant_id: membro.tenant_id,
      }))

      if (membro.perfil === 'cozinha') {
        router.push('/acesso/cozinha')
      } else if (membro.perfil === 'motoboy') {
        router.push('/acesso/motoboy')
      } else {
        setError('Este perfil não tem acesso às páginas de operação')
        setSaving(false)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <ChefHat className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Acesso à Operação</h1>
          <p className="text-sm text-gray-500 mt-1">Faça login com seu usuário e senha</p>
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
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <ChefHat size={18} className="text-orange-500" />
              <span>Cozinha</span>
            </div>
            <div className="flex items-center gap-2">
              <Bike size={18} className="text-green-500" />
              <span>Motoboy</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">
            Solicite seu acesso ao administrador da loja
          </p>
        </div>
      </div>
    </div>
  )
}
