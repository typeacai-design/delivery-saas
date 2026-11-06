'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X, Play, Wallet, Utensils, Users, TrendingUp, ShoppingBag, BarChart3, Headphones, CalendarDays, CheckCircle2, Package, Settings, Truck, Smartphone, Store, ChevronDown } from 'lucide-react'
import './landing-marketing.css'

const features = [
  { Icon: Smartphone, title: 'Cardápio digital personalizado', description: 'Sua vitrine online, com seus produtos e sua marca.' },
  { Icon: ShoppingBag, title: 'Pedidos em tempo real', description: 'Acompanhe cada etapa da operação em um só lugar.' },
  { Icon: BarChart3, title: 'Financeiro e relatórios', description: 'Visualize vendas e tome decisões com mais informação.' },
  { Icon: Users, title: 'Clientes e fidelização', description: 'Conheça seu público e incentive novos pedidos.' },
  { Icon: Utensils, title: 'Cardápio digital', description: 'Divulgue os produtos do seu estabelecimento.' },
  { Icon: Settings, title: 'Personalização', description: 'Configure sua loja para funcionar do seu jeito.' },
]
const plans = [
  { ceiling: 'R$ 5.000', price: 'R$ 50,00' },
  { ceiling: 'R$ 10.000', price: 'R$ 100,00', featured: true },
  { ceiling: 'R$ 15.000', price: 'R$ 150,00' },
]

function Logo() {
 return <Link href="/" className="wd-logo" aria-label="WeDelivery, início"><img src="/we-delivery-official-green.svg" width={46} height={46} alt="" style={{display:"block",width:46,height:46,objectFit:"contain"}} /><span><em>We</em>Delivery</span></Link>
}
function FinanceMock() {
 return <Image sizes="(max-width: 760px) 100vw, 780px" className="wd-device-laptop" src="/marketing/financeiro-notebook.png" width={1080} height={1080} alt="Financeiro do WeDelivery em notebook, com saldo e lançamentos fictícios" fetchPriority="high" decoding="async" />
}
function PhoneMock() {
 return <Image sizes="(max-width: 760px) 65vw, 490px" className="wd-device-phones" src="/marketing/cardapio-iphone.png" width={1080} height={1080} alt="Cardápio digital real da Type Açaí no WeDelivery, exibido em iPhones" fetchPriority="high" decoding="async" />
}
function LeadForm() {
 const [form,setForm]=useState({name:'',business:'',phone:'',goal:''})
 const [sent,setSent]=useState(false)
 return <form className="wd-form" onSubmit={e=>{e.preventDefault();setSent(true)}}><h2>Solicite seu teste grátis <span>por 30 dias!</span></h2><p>Preencha seus dados e nossa equipe entrará em contato.</p><label>Nome completo<input required autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Seu nome"/></label><label>Nome do negócio<input required value={form.business} onChange={e=>setForm({...form,business:e.target.value})} placeholder="Seu restaurante"/></label><label>WhatsApp<input required type="tel" autoComplete="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(00) 00000-0000"/></label><label>O que você quer fazer?<select required value={form.goal} onChange={e=>setForm({...form,goal:e.target.value})}><option value="">Selecione uma opção</option><option>Migrar meu sistema atual</option><option>Criar meu primeiro cardápio digital</option><option>Conhecer a plataforma</option></select></label><button type="submit" className="wd-button wd-button-primary">Quero testar por 30 dias <ArrowRight size={19}/></button>{sent&&<p role="status" className="wd-form-notice">Dados preenchidos nesta demonstração. O envio à equipe será ativado após a integração do formulário.</p>}</form>
}
export default function LandingClient(){
 const [menu,setMenu]=useState(false)
 useEffect(()=>{
  if(!('IntersectionObserver' in window))return
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('wd-visible');observer.unobserve(entry.target)}}),{threshold:.08})
  document.querySelectorAll('.wd-reveal').forEach(el=>observer.observe(el))
  return ()=>observer.disconnect()
 },[])
 return <div className="wd-page">
  <header className="wd-header"><div className="wd-header-inner"><Logo/><nav className={menu?'wd-nav open':'wd-nav'} aria-label="Navegação principal"><a href="#funcionalidades" onClick={()=>setMenu(false)}>Funcionalidades</a><a href="#migracao" onClick={()=>setMenu(false)}>Migração</a><a href="#planos" onClick={()=>setMenu(false)}>Planos</a><a href="#contato" onClick={()=>setMenu(false)}>Contato</a><Link href="/acesso" className="wd-nav-staff">Sou funcionário</Link><Link href="/login" className="wd-nav-login">Entrar</Link><Link href="/registro" className="wd-nav-cta">Teste grátis</Link></nav><button className="wd-menu-toggle" aria-label={menu?'Fechar menu':'Abrir menu'} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>
  <main>
   <section className="wd-hero"><div className="wd-hero-bg"/><div className="wd-container"><div className="wd-hero-copy wd-reveal"><span className="wd-pill">Sistema para Delivery</span><h1>O sistema completo para o seu delivery <span>crescer de verdade.</span></h1><p>Gerencie pedidos, cardápio, financeiro, entregas e muito mais, em um só lugar. Mais controle para o seu negócio.</p></div><div className="wd-devices wd-reveal"><div className="wd-glow-ring"/><FinanceMock/><PhoneMock/><p className="wd-device-caption">Telas reais do WeDelivery. Dados financeiros fictícios.</p></div><div className="wd-hero-actions wd-reveal"><a href="#contato" className="wd-button wd-button-primary">Teste grátis por 30 dias <ArrowRight/></a><a href="#funcionalidades" className="wd-button wd-button-outline"><Play size={18}/> Ver demonstração</a></div></div></section>
   <section id="funcionalidades" className="wd-section wd-container"><div className="wd-section-head wd-reveal"><span className="wd-overline">Tudo conectado</span><h2>Tudo que o seu delivery precisa, <span>em um só sistema.</span></h2><p>Uma plataforma para organizar a operação e oferecer uma experiência melhor aos seus clientes.</p></div><div className="wd-feature-grid">{features.map(({Icon,title,description})=><article className="wd-feature wd-reveal" key={title}><div className="wd-feature-icon"><Icon size={31}/></div><h3>{title}</h3></article>)}</div></section>
   <section id="migracao" className="wd-container wd-migration wd-reveal"><div className="wd-migration-title"><Package size={43}/><h2>Migração <span>100% gratuita</span></h2></div><div className="wd-migration-copy"><p>Já tem um sistema? Nós cuidamos da mudança para o WeDelivery, sem custo de migração.</p><ul><li><CheckCircle2/> Migramos os dados da sua plataforma atual</li><li><CheckCircle2/> Cadastramos todos os produtos do seu cardápio</li><li><CheckCircle2/> Ajudamos a deixar tudo pronto para vender</li></ul></div></section>
   <section className="wd-container wd-trust"><article className="wd-trust-item wd-reveal"><div className="wd-trust-icon"><Headphones size={43}/></div><h2>Suporte <span>de verdade</span></h2><p>Uma equipe preparada para ajudar quando você precisar.</p></article><article className="wd-trust-item wd-reveal"><div className="wd-trust-icon"><CalendarDays size={43}/></div><h2>Primeiro pagamento <span>somente após 30 dias!</span></h2><p>Conheça o sistema, use no dia a dia e pague somente depois de 30 dias.</p></article></section>
   <section id="contato" className="wd-container wd-contact wd-reveal"><LeadForm/></section>
   <section id="planos" className="wd-container wd-pricing"><div className="wd-section-head wd-reveal"><span className="wd-overline">Preço justo</span><h2>Planos simples e <span>acessíveis</span></h2><p>Sem limite de pedidos e sem percentual sobre o faturamento.</p></div><div className="wd-plan-grid">{plans.map(plan=><article className={'wd-plan wd-reveal'+(plan.featured?' featured':'')} key={plan.ceiling}>{plan.featured&&<span className="wd-plan-badge">Mais escolhido</span>}<Store size={28}/><p>Faturamento até<br/><strong>{plan.ceiling}/mês</strong></p><h3>{plan.price}</h3><small>por mês</small></article>)}</div><p className="wd-plan-note">Valores apresentados para as faixas de faturamento informadas. Consulte as condições do serviço.</p></section>
   <section className="wd-container wd-final wd-reveal"><h2>Seu delivery pronto para o próximo nível.</h2><a href="#contato" className="wd-button wd-button-primary">Comece agora seu teste grátis <ArrowRight/></a></section>
  </main><footer className="wd-footer"><Logo/><p>© {new Date().getFullYear()} WeDelivery</p><div><Link href="/acesso">Sou funcionário</Link><Link href="/login">Entrar</Link></div></footer>
 </div>
}
