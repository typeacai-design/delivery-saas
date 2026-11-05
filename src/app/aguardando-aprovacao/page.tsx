'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, ChefHat, ArrowRight } from 'lucide-react'

export default function AguardandoAprovacaoPage() {
  const [nome, setNome] = useState('')
  const [checking, setChecking] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    const loadStatus = async () => {
      const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' })
      const session = await response.json().catch(() => null)
      if (!active) return
      if (!response.ok || !session?.authenticated || !session.tenant) { window.location.href = '/login'; return }
      setNome(session.tenant.nome || '')
      if (session.tenant.status === 'active') window.location.href = '/dashboard'
      if (session.tenant.status === 'suspended') window.location.href = '/login'
    }
    void loadStatus()
    return () => { active = false }
  }, [])
  // Botão "Já fui aprovado? Atualizar" — re-checa o status sem precisar deslogar
  const handleCheckStatus = async () => {
    setChecking(true)
    const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' })
    const session = await response.json().catch(() => null)
    if (!response.ok || !session?.authenticated) { window.location.href = '/login'; return }
    if (session.tenant?.status === 'active') window.location.href = '/dashboard'
    else setChecking(false)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await fetch('/auth/signout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  return (
    <div className="app-shell">
      <div className="app-shell-inner flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
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
              We Delivery
            </span>
          </div>

          <div className="glass-iridescent p-8 relative">
            <div className="relative z-10">
              <div className="flex flex-col items-center text-center">
                <div
                  className="size-16 rounded-full flex items-center justify-center mb-5"
                  style={{ background: 'rgba(245,158,11,.14)' }}
                >
                  <Clock className="w-8 h-8" style={{ color: '#B45309' }} strokeWidth={2} />
                </div>

                <div className="eyebrow mb-2">Aguardando aprovação</div>
                <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                  {nome ? `${nome},` : ''} quase lá!
                </h1>
                <p className="hint mb-7 max-w-sm">
                  Seu cadastro foi realizado com sucesso e está aguardando a aprovação do administrador. Assim que for aprovado, você terá acesso completo ao painel.
                </p>

                <div
                  className="w-full p-4 rounded-2xl text-left mb-5"
                  style={{
                    background: 'rgba(245,158,11,.06)',
                    border: '1px solid rgba(245,158,11,.20)',
                  }}
                >
                  <p className="text-[13px]" style={{ color: '#92400E' }}>
                    💡 <strong>Como funciona:</strong> o administrador recebe os cadastros novos e aprova um por um. Depois de aprovado, basta fazer login novamente pra entrar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={checking}
                  className="btn-primary w-full justify-center mb-3"
                >
                  {checking ? 'Verificando...' : 'Já fui aprovado? Atualizar'}
                  {!checking && <ArrowRight size={14} />}
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="btn-ghost w-full justify-center"
                >
                  {signingOut ? 'Saindo...' : 'Sair da conta'}
                </button>
              </div>
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
