'use client'

import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Store,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Layout client-side do painel admin.
// Auth já foi validada pelo middleware server-side, então
// não precisa de loading state. Isso evita hidratação dupla
// que estava crashando.
export default function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/login', { method: 'DELETE', credentials: 'include' })
    } catch {}
    router.replace('/painel-admin/login')
  }

  const navItems = [
    { href: '/painel-admin', label: 'Visão Geral', icon: LayoutDashboard },
    { href: '/painel-admin/lojistas', label: 'Lojistas', icon: Users },
    { href: '/painel-admin/faturamento', label: 'Cobrança 1%', icon: DollarSign },
    { href: '/painel-admin/mensalidades', label: 'Mensalidades', icon: CreditCard },
    { href: '/painel-admin/relatorios', label: 'Relatórios', icon: BarChart3 },
    { href: '/painel-admin/configuracoes', label: 'Configurações', icon: Settings },
    { href: '/painel-admin/configuracoes?tab=admin', label: 'Perfil e segurança', icon: Shield },
  ]

  return (
    <div className="app-shell">
      <div className="app-shell-inner">
        <div className="glass p-6 rounded-3xl mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="size-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{
                  background: 'var(--green)',
                  boxShadow: '0 8px 22px -10px rgba(22,163,74,.55)',
                }}
              >
                <Store size={18} />
              </div>
              <div>
                <h1 className="font-bold" style={{ color: 'var(--ink)' }}>We Delivery</h1>
                <p className="text-xs hint">Painel Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>

        {/* Nav Pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="btn-ghost flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Content */}
        <div className="glass p-6 rounded-3xl">
          {children}
        </div>
      </div>
    </div>
  )
}
