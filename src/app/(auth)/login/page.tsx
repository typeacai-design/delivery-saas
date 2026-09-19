'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // O login e a seleção da loja precisam ocorrer no servidor: assim os
      // cookies de sessão do Supabase e da loja ativa são gravados juntos.
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const result = await loginResponse.json().catch(() => ({}))
      if (!loginResponse.ok || !result.success) {
        setError(result.error || 'Login falhou')
        setLoading(false)
        return
      }
      window.location.href = result.tenant?.status === 'pending_approval' ? '/aguardando-aprovacao' : '/dashboard'

    } catch (err: any) {
      setError(err.message || 'Erro de conexão')
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="app-shell-inner flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2.5 mb-7">
            <div
              className="size-11 rounded-2xl flex items-center justify-center text-white font-bold text-[13px]"
              style={{
                background: 'var(--grad-violet)',
                border: '1px solid rgba(255,255,255,.4)',
                boxShadow: '0 8px 22px -10px rgba(139,92,246,.55)',
              }}
            >
              <Sparkles size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              We Delivery
            </span>
          </div>

          <div className="glass-iridescent p-8 relative">
            <div className="relative z-10">
              <div className="text-center mb-7">
                <div className="eyebrow mb-2">Acesso</div>
                <h1 className="text-2xl font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
                  Bem-vindo de volta
                </h1>
                <p className="hint">Entre pra gerenciar seus pedidos</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div
                    className="p-3 rounded-2xl text-[13px]"
                    style={{ background: 'rgba(239,68,68,.08)', color: '#991B1B', border: '1px solid rgba(239,68,68,.25)' }}
                  >
                    {error}
                  </div>
                )}

                <div>
                  <label>Email</label>
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
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary justify-center w-full mt-2"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                  {!loading && <ArrowRight size={14} />}
                </button>
              </form>

              <div className="mt-7 pt-5 divider" />

              {/* Botão para funcionários */}
              <div className="mt-5">
                <Link
                  href="/acesso"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-sm border-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    borderColor: 'var(--green)',
                    color: 'var(--green)',
                    background: 'transparent',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Sou funcionário
                </Link>
              </div>

              <p className="hint text-center mt-5">
                Não tem conta?{' '}
                <Link href="/registro" className="link">
                  Cadastre-se
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center hint mt-6">
            © {new Date().getFullYear()} We Delivery · Delivery simples
          </p>
        </div>
      </div>
    </div>
  )
}


