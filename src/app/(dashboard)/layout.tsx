'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Utensils,
  ShoppingCart,
  Package,
  Settings,
  BarChart3,
  LogOut,
  Bell,
  Search,
  Megaphone,
  CreditCard,
  Users,
  Bike,
  Star,
} from 'lucide-react'
import { SidebarNav } from '@/components/sidebar-nav'
import ErrorBoundary from '@/components/error-boundary'
import { createClient } from '@/lib/supabase/client'
import GlobalSomPedidos from '@/components/global-som-pedidos'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [authChecked, setAuthChecked] = useState(false)
  const [tenant, setTenant] = useState<any>(null)
  const [role, setRole] = useState('owner')
  const sair = async () => { await createClient().auth.signOut(); localStorage.removeItem('wedelivery-auth'); window.location.replace('/') }

  useEffect(() => {
    let active = true
    const checkAuth = async () => {
      let response: Response | null = null
      // Aguarda a persistência do cookie após o login; evita um redirecionamento
      // falso quando a primeira leitura ocorre antes do cookie estar disponível.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' })
        if (response.ok) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      if (!active || !response) return
      if (response.status === 401) { router.replace('/login?error=session'); return }
      if (!response.ok) { router.replace('/login?error=access'); return }
      const session = await response.json()
      const t = session?.tenant
      if (!t) { router.replace('/login'); return }
      if (session.role) setRole(session.role)
      if (t.status === 'pending_approval') { router.replace('/aguardando-aprovacao'); return }
      setTenant(t)
      setAuthChecked(true)
    }
    void checkAuth()
    return () => { active = false }
  }, [router])

  useEffect(() => {
    if (!authChecked) return
    if (pathname === '/motoboys') { router.replace('/equipe'); return }
    if (['/avaliacoes', '/sorteios', '/embaixadores'].includes(pathname)) { router.replace('/marketing'); return }
    const allowed = role === 'attendant' ? ['/dashboard', '/pedidos', '/clientes']
      : ['kitchen', 'motoboy', 'delivery'].includes(role) ? ['/dashboard', '/pedidos'] : null
    if (allowed && !allowed.some((route) => pathname === route || pathname.startsWith(route + '/'))) router.replace('/pedidos')
  }, [authChecked, pathname, role, router])

  const initials = (tenant?.nome || 'F')
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (!authChecked) {
    return (
      <div className="app-shell">
        <div className="app-shell-inner">
          <div className="glass p-8 rounded-3xl text-center" style={{ maxWidth: 400, margin: '0 auto', marginTop: '4rem' }}>
            <div className="size-12 mx-auto mb-4 rounded-full flex items-center justify-center animate-pulse" style={{ background: 'rgba(22,163,74,.2)' }}>
              <CreditCard size={24} style={{ color: 'var(--green)' }} />
            </div>
            <p className="hint">Carregando painel...</p>
          </div>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
    { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
    { href: '/clientes', label: 'Clientes', icon: Users },
    { href: '/cardapio', label: 'Cardápio', icon: Utensils },
    { href: '/gestao', label: 'Gestão', icon: Package },
    { href: '/marketing', label: 'Marketing', icon: Megaphone },
    { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { href: '/configuracoes', label: 'Configurações', icon: Settings },
  ]

  return (
    <GlobalSomPedidos>
    <div className="app-shell">
      <div className="app-shell-inner">
        <div className="app-grid">
          {/* SIDEBAR */}
          <aside className="w-[232px] shrink-0 hidden lg:flex flex-col gap-3 self-start sticky top-3">
            <div className="glass px-4 py-4 flex items-center gap-3">
              <Link href="/configuracoes?tab=perfil" aria-label="Abrir meu perfil"
                className="size-10 rounded-2xl flex items-center justify-center text-white font-bold text-[13px] overflow-hidden"
                style={{
                  background: 'var(--grad-violet)',
                  border: '1px solid rgba(255,255,255,.4)',
                  boxShadow: '0 8px 22px -10px rgba(139,92,246,.55)'
                }}
              >
                {tenant?.logo_url ? <img src={tenant.logo_url} alt={`Logo de ${tenant.nome}`} className="w-full h-full object-contain bg-white" /> : initials}
              </Link>
              <div className="leading-tight min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-faint)' }}>
                  We Delivery
                </div>
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {tenant?.nome || 'We Delivery'}
                </div>
              </div>
            </div>

            <SidebarNav role={role} />

            <button type="button" onClick={sair} className="glass w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/75 transition rounded-2xl" style={{ color: 'var(--ink-muted)' }}>
                <LogOut size={16} />
                <span>Sair</span>
              </button>
          </aside>

          <div className="app-content">
            <header className="glass px-5 py-3 flex items-center gap-4 sticky top-3 z-30">
              <div className="lg:hidden flex items-center gap-2">
                <div
                  className="size-8 rounded-xl flex items-center justify-center text-white font-bold text-[11px]"
                  style={{ background: 'var(--grad-violet)' }}
                >
                  {initials}
                </div>
                <span className="font-display text-base" style={{ color: 'var(--ink)' }}>
                  We Delivery
                </span>
              </div>

              <div className="flex-1 relative hidden sm:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ink-faint)' }} />
                <input
                  type="search"
                  placeholder="Buscar pedido, produto, cliente…"
                  className="pl-11"
                  style={{ color: 'var(--ink)' }}
                />
              </div>

              <button className="btn-icon-round ml-auto">
                <Bell size={16} />
              </button>
            </header>

            <main className="flex-1 min-w-0"><ErrorBoundary>{children}</ErrorBoundary></main>
          </div>
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t" style={{ borderColor: 'var(--line)' }}>
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {( role === 'attendant' ? navItems.filter(item => ['/dashboard','/pedidos','/clientes'].includes(item.href)) : ['kitchen', 'motoboy', 'delivery'].includes(role) ? navItems.filter(item => ['/dashboard','/pedidos'].includes(item.href)) : navItems).slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-1.5 rounded-xl"
              style={{ color: 'var(--ink-muted)' }}
            >
              <item.icon className="w-4 h-4" strokeWidth={2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
    </GlobalSomPedidos>
  )
}




