'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Menu, X, Utensils, Users, ShoppingBag, BarChart3, Headphones, CalendarDays, CheckCircle2, Settings, Smartphone, Store, Database, ClipboardList, ArrowLeftRight } from 'lucide-react'
import { trialLeadGoals } from '@/lib/trial-leads'
import { mensalidadeCentavos } from '@/lib/assinaturas'
import './landing-marketing.css'
import './landing-home-approved.css'

const features = [
  { Icon: Smartphone, title: 'Cardápio digital personalizado', description: 'Sua vitrine online, com seus produtos e sua marca.' },
  { Icon: ShoppingBag, title: 'Pedidos em tempo real', description: 'Acompanhe cada etapa da operação em um só lugar.' },
  { Icon: BarChart3, title: 'Financeiro e relatórios', description: 'Visualize vendas e tome decisões com mais informação.' },
  { Icon: Users, title: 'Clientes e fidelização', description: 'Conheça seu público e incentive novos pedidos.' },
  { Icon: Utensils, title: 'Cardápio digital', description: 'Divulgue os produtos do seu estabelecimento.' },
  { Icon: Settings, title: 'Personalização', description: 'Configure sua loja para funcionar do seu jeito.' },
]
const currency = (n: number) => `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n)}`

function RevenueSimulator() {
 const [revenue, setRevenue] = useState(2000)
 const fee = mensalidadeCentavos(revenue * 100) / 100
 const progress = revenue / 15000 * 100
 return <>
  <div className="wd-simulator" id="simulador">
   <div className="wd-simulator-input"><div className="wd-simulator-label"><label htmlFor="revenue">Quanto seu delivery fatura por mês?</label><output id="revenue-value" htmlFor="revenue">{currency(revenue)}</output></div>
    <input id="revenue" type="range" min={0} max={15000} step={500} value={revenue} aria-label="Faturamento mensal" aria-valuetext={currency(revenue)} onChange={e => setRevenue(Number(e.target.value))} style={{background: `linear-gradient(90deg,#a9ff00 ${progress}%,#34462b ${progress}%)`}}/>
    <div className="wd-range-ticks"><span>R$ 0</span><span>R$ 5 mil</span><span>R$ 10 mil</span><span>R$ 15 mil</span></div>
   </div>
   <div className="wd-simulator-result" aria-live="polite"><div><span className="wd-simulator-muted">Sua mensalidade</span><div className="wd-simulator-price"><strong id="fee">{currency(fee)}</strong><small>/mês</small></div></div><span className="wd-simulator-badge">{fee ? 'SEM COMISSÃO' : 'PLANO GRÁTIS'}</span></div>
  </div>
  <div className="wd-simulator-message">{fee ? 'Sem percentual sobre suas vendas.' : 'Grátis enquanto faturar até R$ 2 mil por mês.'}</div>
  <div className="wd-simulator-actions"><Link href="/registro" className="wd-button wd-button-primary">{fee ? 'Começar agora' : 'Começar gratuitamente'}</Link><a href="#funcionalidades" className="wd-button wd-button-outline">Ver demonstração</a></div>
 </>
}

function MigrationCard() {
 const items = [
  { Icon: Database, title: 'Seus dados', description: 'Migramos os dados da sua plataforma atual.' },
  { Icon: ClipboardList, title: 'Seu cardápio', description: 'Cadastramos todos os produtos para você.' },
  { Icon: CheckCircle2, title: 'Tudo pronto', description: 'Ajudamos a deixar sua loja pronta para vender.' },
 ]
 return <section id="migracao" className="wd-container wd-migration wd-migration-premium wd-reveal">
  <div className="wd-mig-top"><div className="wd-mig-copy"><h2 className="wd-mig-two-line"><span className="wd-mig-first-line">Mudar para o WeDelivery é</span><span>100% gratuito.</span></h2><p>Nós cuidamos da migração, do cadastro dos produtos e de toda a preparação para você começar a vender.</p><a href="#contato" className="wd-button wd-button-primary">Quero migrar meu sistema</a></div>
   <div className="wd-mig-visual" aria-label="Migração do sistema atual para o WeDelivery"><div className="wd-mig-glow"/><div className="wd-mig-platform wd-mig-old"><div className="wd-mig-platform-icon"><Store size={32}/></div><strong>Sistema atual</strong><small>Seus dados e produtos</small></div><div className="wd-mig-transfer"><ArrowLeftRight size={30}/><span>Migração gratuita</span></div><div className="wd-mig-platform wd-mig-new"><div className="wd-mig-platform-icon"><img src="/we-delivery-official-green.svg" alt="" width={38} height={38}/></div><strong>WeDelivery</strong><small><i/> Pronto para vender</small></div></div>
  </div>
  <div className="wd-mig-features">{items.map(({ Icon, title, description }) => <article key={title}><div className="wd-mig-icon"><Icon size={26}/></div><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
 </section>
}

function WhatsAppButton() {
 const message = encodeURIComponent('Olá, quero saber mais sobre o WeDelivery')
 return <a href={`https://wa.me/5547991701079?text=${message}`} className="wd-whatsapp-float" target="_blank" rel="noopener noreferrer" aria-label="Fale com o WeDelivery pelo WhatsApp" title="Fale com a gente"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.44 14.91L2 22l5.25-1.55A9.86 9.86 0 1 0 12.04 2Zm0 17.95a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.1.92.94-3.02-.2-.32a8.14 8.14 0 1 1 6.79 3.73Zm4.47-6.07c-.24-.12-1.45-.72-1.68-.8-.23-.08-.4-.12-.56.12-.17.24-.64.8-.79.97-.14.16-.28.18-.53.06-.24-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.71-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.75-1.82-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31s-.85.83-.85 2.02.87 2.34.99 2.5c.12.16 1.72 2.62 4.15 3.67.58.25 1.03.4 1.39.51.58.18 1.11.16 1.53.1.47-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28Z"/></svg></a>
}

function Logo() {
 return <Link href="/" className="wd-logo" aria-label="WeDelivery, início"><img src="/we-delivery-official-green.svg" width={46} height={46} alt="" style={{display:"block",width:46,height:46,objectFit:"contain"}} /><span><em>We</em>Delivery</span></Link>
}
function FinanceMock() {
 return <Image sizes="(max-width: 760px) 100vw, 780px" className="wd-device-laptop" src="/marketing/financeiro-notebook.webp" width={1080} height={1080} alt="Financeiro do WeDelivery em notebook, com saldo e lançamentos fictícios" fetchPriority="high" decoding="async" />
}
function PhoneMock() {
 return <Image sizes="(max-width: 760px) 65vw, 490px" className="wd-device-phones" src="/marketing/cardapio-iphone.png" width={1080} height={1080} alt="Cardápio digital real da Type Açaí no WeDelivery, exibido em iPhones" fetchPriority="high" decoding="async" />
}
function LeadForm() {
 const [sending, setSending] = useState(false)
 const [sent, setSent] = useState(false)
 const [error, setError] = useState('')

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (sending) return

  const form = event.currentTarget
  const fields = Object.fromEntries(new FormData(form))
  const fallback = 'Não foi possível enviar sua solicitação. Tente novamente.'
  setSending(true)
  setSent(false)
  setError('')

  try {
   const response = await fetch('/api/trial-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
   })
   const result = await response.json()
   if (!response.ok || result.success !== true) {
    setError(typeof result.error === 'string' ? result.error : fallback)
    return
   }

   form.reset()
   setSent(true)
  } catch {
   setError(fallback)
  } finally {
   setSending(false)
  }
 }

 return (
  <form className="wd-form" method="post" onSubmit={submit}>
   <h2>Solicite seu teste grátis <span>por 30 dias!</span></h2>
   <p>Preencha seus dados e nossa equipe entrará em contato.</p>
   <label>Nome completo<input name="name" required maxLength={120} autoComplete="name" placeholder="Seu nome" /></label>
   <label>Nome do negócio<input name="business" required maxLength={160} autoComplete="organization" placeholder="Seu restaurante" /></label>
   <label>WhatsApp<input name="phone" required type="tel" maxLength={32} autoComplete="tel" placeholder="(00) 00000-0000" /></label>
   <label>
    O que você quer fazer?
    <select name="goal" required defaultValue="">
     <option value="">Selecione uma opção</option>
     {trialLeadGoals.map(goal => <option key={goal}>{goal}</option>)}
    </select>
   </label>
   <button type="submit" className="wd-button wd-button-primary" disabled={sending}>
    {sending ? 'Enviando…' : 'Quero testar por 30 dias'} <ArrowRight size={19} />
   </button>
   {sent && <p role="status" className="wd-form-notice">Solicitação enviada! Nossa equipe vai entrar em contato pelo WhatsApp.</p>}
   {error && <p role="alert">{error}</p>}
  </form>
 )
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
  <header className="wd-header"><div className="wd-header-inner"><Logo/><nav className={menu?'wd-nav open':'wd-nav'} aria-label="Navegação principal"><a href="#funcionalidades" onClick={()=>setMenu(false)}>Funcionalidades</a><a href="#migracao" onClick={()=>setMenu(false)}>Migração</a><a href="#simulador" onClick={()=>setMenu(false)}>Mensalidade</a><a href="#contato" onClick={()=>setMenu(false)}>Contato</a><Link href="/acesso" className="wd-nav-staff">Sou funcionário</Link><Link href="/login" className="wd-nav-login">Entrar</Link><Link href="/registro" className="wd-nav-cta">Cadastrar</Link></nav><div className="wd-mobile-header-actions"><Link className="wd-mobile-login" href="/login">Login</Link><Link className="wd-mobile-register" href="/registro">Cadastrar</Link><button className="wd-menu-toggle" aria-label={menu?'Fechar menu':'Abrir menu'} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></div></header>
  <main>
   <section className="wd-hero"><div className="wd-hero-bg"/><div className="wd-container"><div className="wd-hero-copy wd-reveal"><span className="wd-pill">Até 50% mais barato que a concorrência</span><h1 aria-label="O cardápio digital que vende mais e custa menos">O cardápio digital que <span className="wd-headline-pair">vende <b className="wd-headline-symbol wd-symbol-plus" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M20 8v24M8 20h24" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></svg></b></span> <span className="wd-headline-pair wd-headline-accent">e custa <b className="wd-headline-symbol wd-symbol-minus" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M8 20h24" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></svg></b></span></h1><RevenueSimulator/></div><div className="wd-devices wd-reveal"><div className="wd-glow-ring"/><FinanceMock/><PhoneMock/><p className="wd-device-caption">Telas reais do WeDelivery. Dados financeiros fictícios.</p></div></div></section>
   <section id="funcionalidades" className="wd-section wd-container"><div className="wd-section-head wd-reveal"><span className="wd-overline">Tudo conectado</span><h2>Tudo que o seu delivery precisa, <span>em um só sistema.</span></h2><p>Uma plataforma para organizar a operação e oferecer uma experiência melhor aos seus clientes.</p></div><div className="wd-feature-grid">{features.map(({Icon,title})=><article className="wd-feature wd-reveal" key={title}><div className="wd-feature-icon"><Icon size={31}/></div><h3>{title}</h3></article>)}</div></section>
   <MigrationCard/>
   <section className="wd-container wd-trust"><article className="wd-trust-item wd-reveal"><div className="wd-trust-icon"><Headphones size={43}/></div><h2>Suporte <span>de verdade</span></h2><p>Uma equipe preparada para ajudar quando você precisar.</p></article><article className="wd-trust-item wd-reveal"><div className="wd-trust-icon"><CalendarDays size={43}/></div><h2>Primeiro pagamento <span>somente após 30 dias!</span></h2><p>Conheça o sistema, use no dia a dia e pague somente depois de 30 dias.</p></article></section>
   <section id="contato" className="wd-container wd-contact wd-reveal"><LeadForm/></section>
  </main><footer className="wd-footer"><Logo/><p>© {new Date().getFullYear()} WeDelivery</p><div><Link href="/acesso">Sou funcionário</Link><Link href="/login">Entrar</Link></div></footer>
  <WhatsAppButton/>
 </div>
}
