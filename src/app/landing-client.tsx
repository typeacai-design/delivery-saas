'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, ChefHat, Megaphone, ShieldCheck, ShoppingBag, Smartphone, Store, Users } from 'lucide-react'

const features = [
  { icon: Smartphone, title: 'Cardápio digital responsivo', desc: 'Seu cliente pede pelo celular com poucos cliques.' },
  { icon: ShoppingBag, title: 'Pedidos no WhatsApp', desc: 'Cada pedido chega direto no seu WhatsApp com itens, endereço e pagamento.' },
  { icon: Megaphone, title: 'Marketing e cupons', desc: 'Recupere clientes inativos e envie cupons de aniversário.' },
  { icon: BarChart3, title: 'Relatórios em tempo real', desc: 'Saiba quais produtos vendem mais e em quais horários.' },
  { icon: ShieldCheck, title: 'Aprovação segura', desc: 'Cada novo cadastro passa por análise antes de ir ao ar.' },
  { icon: Users, title: 'Equipe com permissões', desc: 'Adicione atendentes, donos e entregadores.' },
]

export default function LandingClient() {
  return (
    <div className="app-shell"><div className="app-shell-inner">
      <header className="flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="We Delivery — início">
          <div className="size-10 rounded-2xl flex items-center justify-center text-white" style={{ background: 'var(--green)' }}><ChefHat size={18} strokeWidth={2.5} /></div>
          <span className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>We Delivery</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Acesso">
          <Link href="/login" className="btn-ghost text-sm">Entrar</Link>
          <Link href="/registro" className="btn-primary text-sm">Começar grátis<ArrowRight size={14} /></Link>
        </nav>
      </header>
      <main>
        <section className="glass-iridescent px-7 py-14 my-8 text-center">
          <div className="eyebrow mb-3"><Store size={11} />Plataforma multi-tenant de delivery</div>
          <h1 className="text-4xl md:text-6xl font-semibold mb-5" style={{ color: 'var(--ink)' }}>Transforme seu restaurante em <span style={{ color: 'var(--green)' }}>vendas digitais</span></h1>
          <p className="hint mb-8 max-w-2xl mx-auto">Cardápio online, pedidos no WhatsApp, marketing e relatórios.</p>
          <Link href="/registro" className="btn-primary">Quero meu cardápio digital<ArrowRight size={16} /></Link>
        </section>
        <section className="my-16" aria-labelledby="recursos-title">
          <div className="text-center mb-10"><div className="eyebrow mb-2">Recursos</div><h2 id="recursos-title" className="text-3xl md:text-4xl font-semibold">Tudo que seu delivery precisa</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => <article key={feature.title} className="glass-soft p-6 rounded-3xl"><div className="size-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(22,163,74,.12)' }}><feature.icon size={20} style={{ color: 'var(--green)' }} /></div><h3 className="font-semibold mb-2">{feature.title}</h3><p className="hint">{feature.desc}</p></article>)}
          </div>
        </section>
      </main>
      <footer className="py-8 text-center hint text-xs">© {new Date().getFullYear()} We Delivery</footer>
    </div></div>
  )
}
