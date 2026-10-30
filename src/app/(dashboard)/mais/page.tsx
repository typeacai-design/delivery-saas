import Link from 'next/link'
import { Package, Users, Megaphone, BarChart3, Settings, ChevronRight, UserRound, Utensils, CircleHelp } from 'lucide-react'

const items = [
  { href: '/gestao', label: 'Estoque', icon: Package },
  { href: '/equipe', label: 'Equipe', icon: Users },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/clientes', label: 'Clientes', icon: UserRound },
  { href: '/mesas', label: 'Mesas', icon: Utensils },
  { href: '/suporte', label: 'Suporte', icon: CircleHelp },
]

export default function MaisPage() {
  return <div className="wd-more-page">
    <div className="wd-page-heading"><h1>Tudo da sua loja</h1><p>Organizado em um só lugar</p></div>
    <div className="wd-menu">{items.map(item => <Link key={item.href} href={item.href}>
      <item.icon size={20} aria-hidden="true" /><span>{item.label}</span><ChevronRight size={16} aria-hidden="true" />
    </Link>)}</div>
  </div>
}
