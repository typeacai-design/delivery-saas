'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Utensils, Wallet, Menu, LogOut } from 'lucide-react'

const items = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/cardapio', label: 'Cardápio', icon: Utensils },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/mais', label: 'Mais', icon: Menu },
]

export default function MerchantMobileNav({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname()
  const mainRoute = items.slice(0, 4).find(item => pathname === item.href || pathname.startsWith(item.href + '/'))
  return <>
    {pathname === '/mais' && <div className="wd-mobile-logout"><button type="button" onClick={onLogout}><LogOut size={17} aria-hidden="true" />Sair da conta</button></div>}
    <nav className="wd-merchant-nav" aria-label="Navegação da loja no celular">
      {items.map(item => {
        const active = item.href === '/mais' ? !mainRoute : mainRoute?.href === item.href
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
          <item.icon size={20} aria-hidden="true" /><span>{item.label}</span>
        </Link>
      })}
    </nav>
  </>
}
