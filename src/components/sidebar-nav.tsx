'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Utensils,
  ShoppingCart,
  Package,
  Settings,
  BarChart3,
  Megaphone,
  Users,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const items: NavItem[] = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/cardapio', label: 'Cardápio', icon: Utensils },
  { href: '/gestao', label: 'Estoque', icon: Package },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/equipe', label: 'Equipe', icon: Users },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function SidebarNav({ role = 'owner' }: { role?: string }) {
  const path = usePathname()
  const allowed = role === 'attendant' ? ['/dashboard', '/pedidos', '/clientes']
    : ['kitchen', 'motoboy', 'delivery'].includes(role) ? ['/dashboard', '/pedidos'] : null
  const visibleItems = allowed ? items.filter((item) => allowed.includes(item.href)) : items

  return (
    <nav className="glass p-2 flex flex-col gap-0.5">
      {visibleItems.map((it) => {
        // "/" é exact match pra evitar ativar em qualquer rota
        const isActive = path === it.href || (path?.startsWith(it.href + '/') ?? false)

        const Icon = it.icon

        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
              isActive
                ? 'text-ink font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-white/40'
            )}
            style={
              isActive
                ? {
                    background:
                      'linear-gradient(135deg, rgba(139,92,246,.18), rgba(167,139,250,.08))',
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,.7), 0 0 0 1px rgba(139,92,246,.35), 0 0 24px -2px rgba(139,92,246,.45), 0 0 48px -8px rgba(139,92,246,.30), 0 4px 12px -4px rgba(139,92,246,.35)',
                    border: '1px solid rgba(139,92,246,.30)',
                  }
                : undefined
            }
          >
            <Icon
              size={16}
              style={isActive ? { color: 'var(--violet)' } : undefined}
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span className="truncate">{it.label}</span>
            {isActive && (
              <span
                className="ml-auto w-1.5 h-1.5 rounded-full"
                style={{
                  background: 'var(--violet)',
                  boxShadow: '0 0 8px var(--violet)',
                }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}


