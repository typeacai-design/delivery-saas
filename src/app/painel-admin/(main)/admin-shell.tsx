'use client'

import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, BarChart3, Settings, Shield, LogOut, Store, DollarSign, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const navItems = [
  { href: '/painel-admin', label: 'Visão geral', mobileLabel: 'Início', icon: LayoutDashboard },
  { href: '/painel-admin/lojistas', label: 'Lojistas', mobileLabel: 'Lojistas', icon: Users },
  { href: '/painel-admin/faturamento', label: 'Cobrança 1%', mobileLabel: 'Cobranças', icon: DollarSign },
  { href: '/painel-admin/relatorios', label: 'Relatórios', mobileLabel: 'Relatórios', icon: BarChart3 },
  { href: '/painel-admin/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/painel-admin/configuracoes?tab=admin', label: 'Perfil e segurança', icon: Shield },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError('')
    try {
      const response = await fetch('/api/admin/login', { method: 'DELETE', credentials: 'include' })
      if (!response.ok) throw new Error('Não foi possível sair.')
      router.replace('/painel-admin/login')
      router.refresh()
    } catch {
      setLogoutError('Não foi possível sair. Tente novamente.')
      setLoggingOut(false)
    }
  }

  const isActive = (href: string) => href === '/painel-admin'
    ? pathname === href
    : !href.includes('?') && (pathname === href || pathname.startsWith(href + '/'))

  return (
    <div className="wd-admin">
      <div className="wd-admin-container">
        <header className="wd-admin-header">
          <Link href="/painel-admin" className="wd-admin-brand" aria-label="We Delivery — início do administrador">
            <span className="wd-admin-logo"><Store size={22} aria-hidden="true" /></span>
            <span><strong>We Delivery</strong><small>Administração</small></span>
          </Link>
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="wd-admin-logout">
            <LogOut size={18} aria-hidden="true" />{loggingOut ? 'Saindo…' : 'Sair'}
          </button>
        </header>
        {logoutError && <p role="alert" className="wd-admin-error">{logoutError}</p>}

        <nav className="wd-admin-desktop-nav" aria-label="Navegação administrativa">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? 'is-active' : ''}
              aria-current={isActive(item.href) ? 'page' : undefined}>
              <item.icon size={18} aria-hidden="true" />{item.label}
            </Link>
          ))}
        </nav>

        <main id="admin-content" className="wd-admin-content">{children}</main>
      </div>

      {menuOpen && (
        <>
          <button type="button" className="wd-admin-menu-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
          <div id="admin-more-menu" className="wd-admin-more-menu" aria-label="Mais opções">
            <div className="wd-admin-menu-title"><strong>Mais opções</strong><button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button></div>
            {navItems.slice(4).map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}><item.icon size={20} aria-hidden="true" />{item.label}</Link>
            ))}
          </div>
        </>
      )}
      <nav className="wd-admin-mobile-nav" aria-label="Navegação administrativa no celular">
        {navItems.slice(0, 4).map(item => (
          <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={isActive(item.href) && !menuOpen ? 'is-active' : ''}
            aria-current={isActive(item.href) ? 'page' : undefined}>
            <item.icon size={21} aria-hidden="true" /><span>{item.mobileLabel}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="admin-more-menu"
          className={menuOpen || pathname.startsWith('/painel-admin/configuracoes') ? 'is-active' : ''}>
          {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}<span>Mais</span>
        </button>
      </nav>
    </div>
  )
}

