'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChefHat, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (data.success) {
        // Cookie HttpOnly setado pelo backend; sem localStorage.
        router.push('/painel-admin')
      } else {
        setError(data.error || 'Credenciais incorretas')
      }
    } catch {
      setError('Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div
            className="size-11 rounded-2xl flex items-center justify-center text-white"
            style={{
              background: 'var(--green)',
              border: '1px solid rgba(255,255,255,.4)',
              boxShadow: '0 8px 22px -10px rgba(22,163,74,.55)',
            }}
          >
            <ChefHat size={18} strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
            We Delivery · Admin
          </span>
        </div>

        <div className="glass p-8">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ink)' }}>
              Painel do Administrador
            </h1>
            <p className="hint">Acesse para gerenciar seus lojistas</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-2xl text-[13px] flex items-center gap-2"
                style={{ background: 'rgba(220,38,38,.08)', color: '#991B1B', border: '1px solid rgba(220,38,38,.25)' }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label>Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading ? 'Entrando...' : 'Acessar painel'}
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>
        </div>

        <p className="text-center hint mt-6">
          © {new Date().getFullYear()} We Delivery · Painel Administrativo
        </p>
      </div>
    </div>
  )
}
