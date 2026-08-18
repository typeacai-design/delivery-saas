'use client'

import { useState, useMemo, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { ShoppingCart, Search, SlidersHorizontal, MapPin, ChevronDown, Home, FileText, ShoppingBag, User, Plus, Bell, Clock, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CheckoutDrawer, ProdutoModal, CartItem } from './checkout-flow'
import { PublicReviews } from './public-reviews'
import { CustomerOrders, CustomerProfile } from './customer-account'

function BannerCarousel({ banners, fallback, height = 'h-56' }: { banners: string[]; fallback: React.ReactNode; height?: string }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (banners.length < 2) return
    const timer = window.setInterval(() => setActive((value) => (value + 1) % banners.length), 5000)
    return () => window.clearInterval(timer)
  }, [banners.length])
  if (!banners.length) return <>{fallback}</>
  return <div className={`wd-banner relative rounded-2xl overflow-hidden mb-6 ${height} bg-gray-100`}>
    {banners.map((url, index) => <img key={url} src={url} alt={`Banner promocional ${index + 1}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${index === active ? 'opacity-100' : 'opacity-0'}`} />)}
    {banners.length > 1 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
      {banners.map((_, index) => <button key={index} type="button" aria-label={`Mostrar banner ${index + 1}`} onClick={() => setActive(index)} className={`w-2 h-2 rounded-full ${index === active ? 'bg-white' : 'bg-white/50'}`} />)}
    </div>}
  </div>
}

function StoreActions({ data }: { data: any }) {
  const [horariosAbertos, setHorariosAbertos] = useState(false)
  const horarios = data.horariosSemana?.length ? data.horariosSemana : [{ dia: 'Hoje', abre: data.horario?.abre, fecha: data.horario?.fecha }]
  return <>
    <div className="px-3 sm:px-4 mb-4 max-w-lg mx-auto"><div className="flex items-center justify-between w-full">
      <button type="button" onClick={() => setHorariosAbertos(true)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 text-red-700 px-1.5 py-1 text-[11px] font-semibold shadow-sm"><span>Fechado</span>{data.horario?.abre && <span className="text-emerald-700 bg-white rounded px-1 py-0.5 text-[10px]">{data.horario.abre} - {data.horario.fecha}</span>}<span className="inline-grid place-items-center size-3.5 rounded-full bg-teal-500 text-white text-[9px] font-bold">i</span></button>
      <span title="Avaliações" className="inline-flex items-center gap-1 px-2.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--cardapio-secondary)', background: 'color-mix(in srgb, var(--cardapio-secondary) 12%, white)' }}><Star size={14} fill="currentColor" />{data.totalAvaliacoes ? `${data.avaliacaoMedia} (${data.totalAvaliacoes})` : '0,0'}</span>
    </div></div>
    {horariosAbertos && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={() => setHorariosAbertos(false)}><div className="wd-overlay w-full max-w-sm rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Horários de funcionamento</h2><button type="button" onClick={() => setHorariosAbertos(false)} className="text-2xl leading-none">×</button></div><div className="space-y-2">{horarios.map((h: any, i: number) => <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span className="font-medium">{h.dia || h.nome || `Dia ${i + 1}`}</span><span>{h.abre && h.fecha ? `${h.abre} - ${h.fecha}` : 'Fechado'}</span></div>)}</div></div></div>}
  </>
}

function FloatingWhatsApp({ data }: { data:any }) { const ajuda=data.whatsappAjuda; const numero=String(ajuda?.numero||'').replace(/\D/g,''); if(!ajuda?.ativo||!numero)return null; const href=`https://wa.me/${numero.startsWith('55')?numero:`55${numero}`}?text=${encodeURIComponent(ajuda.mensagem||'')}`; return <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp" className="wd-whatsapp-float"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.1 19.8L3 29l6.4-1.8A13 13 0 1 0 16 3Zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.8 1 1-3.7-.3-.4A10.6 10.6 0 1 1 16 26.6Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-1.9-.9-3.2-1.7-4.5-3.8-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.6-.5-.8-.5h-.7c-.2 0-.6.1-1 .5-1.1 1.2-1.4 2.7-.8 4.2 1.5 3.6 4.1 6.3 7.6 7.8 2.8 1.2 4.6.8 5.6-.5.4-.5.6-1.4.4-2.2-.2-.3-.8-.5-1.1-.7Z"/></svg></a> }

function StoreIdentity({ data, totalItens, onAbrirCarrinho, enderecoCliente, onEditarEndereco }: any) {
  return <header className="wd-store-header px-4 pt-4 pb-2 max-w-lg mx-auto text-center">
    <div className="relative flex flex-col items-center">
      <div className="size-16 rounded-full overflow-hidden border-2 bg-white flex items-center justify-center" style={{ borderColor: data.theme.primary }}>
        {data.tenant.logo_url ? <img src={data.tenant.logo_url} alt={`Logo de ${data.tenant.nome}`} className="w-full h-full object-contain" /> : <ShoppingBag className="w-7 h-7" style={{ color: data.theme.primary }} />}
      </div>
      <h1 className="mt-2 text-xl font-bold leading-tight">{data.tenant.nome}</h1>
      <button type="button" onClick={onEditarEndereco} className="mt-1 inline-flex max-w-full items-center gap-1 text-sm font-medium" style={{ color: data.theme.primary }}>
        <MapPin className="w-4 h-4 shrink-0" /><span className="text-gray-500 shrink-0">Entregar em:</span><span className="truncate">{enderecoCliente || 'Seu endereco'}</span><ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      <button onClick={onAbrirCarrinho} className="wd-icon-button absolute right-0 top-2 size-11 rounded-full shadow flex items-center justify-center" aria-label="Abrir carrinho">
        <ShoppingCart className="w-6 h-6" />
        {totalItens > 0 && <span className="wd-badge absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center">{totalItens}</span>}
      </button>
    </div>
  </header>
}

const ETIQUETAS = {
  promocao: { label: 'Promoção', icone: '🔥', bg: '#FEF3C7', color: '#92400E' },
  mais_vendido: { label: 'Mais vendido', icone: '⭐', bg: '#FEF9C3', color: '#854D0E' },
  novidade: { label: 'Novidade', icone: '✨', bg: '#DBEAFE', color: '#1E3A8A' },
}

function ProductPreco({ produto, className = '' }: { produto: any; className?: string }) {
  const preco = Number(produto.preco)
  const riscado = produto.preco_riscado != null ? Number(produto.preco_riscado) : null
  const temPromo = riscado != null && riscado > preco
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="wd-price font-bold text-sm">{formatCurrency(preco)}</span>
      {temPromo && (
        <span className="text-xs text-gray-400 line-through">{formatCurrency(riscado)}</span>
      )}
    </div>
  )
}

function ProductTags({ produto, className = '' }: { produto: any; className?: string }) {
  const tags = produto.etiquetas || []
  if (tags.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((t: string) => {
        const cfg = ETIQUETAS[t as keyof typeof ETIQUETAS]
        if (!cfg) return null
        return (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            <span>{cfg.icone}</span>
            {cfg.label}
          </span>
        )
      })}
    </div>
  )
}

// Tempo máximo de preparo do carrinho (o maior entre os produtos)
function maxTempoCarrinho(itens: CartItem[]): number {
  if (!itens.length) return 0
  return Math.max(...itens.map(i => i.tempo_preparo_min || 30))
}

function formatFaixaTempo(min: number): string {
  if (min <= 0) return ''
  const minFaixa = Math.max(5, Math.round(min * 0.9))
  const maxFaixa = Math.round(min * 1.2)
  if (minFaixa === maxFaixa) return `${minFaixa} min`
  return `${minFaixa}-${maxFaixa} min`
}

interface CardapioData {
  tenant: {
    id: string
    nome: string
    slug: string
    telefone: string
    logo_url: string | null
    banner_url: string | null
    banners: string[]
    endereco: string
  }
  categorias: any[]
  categoriasProduto: any[]
  produtos: any[]
  variantes: any[]
  complementos: any[]
  listasComplementos: any[]
  produtoComplementos: any[]
  enderecos: any[]
  formasPagamento: { id: string; nome: string }[]
  entregaConfig?: any
  horario: { abre: string; fecha: string }
  layout: string
  paleta: string
  tipografia: 'classica' | 'moderna' | 'minimalista'
  corPaleta: string
  theme: { background: string; surface: string; primary: string; secondary: string; accent: string; text: string; muted: string; button: string }
  lojaAberta: boolean
  valorMinimoPedido: number
  totalBairros: number
  avaliacaoMedia: number
  totalAvaliacoes: number
  whatsappAjuda: { ativo: boolean; numero: string; mensagem: string }
  faixaAvisos: { ativo: boolean; mensagem: string; corFundo: string; corTexto: string; link: string }
  segundaFaixa: { ativo: boolean; mensagem: string; link: string }
}

function AnnouncementStrip({ faixa }: { faixa: any }) {
  const textos = (faixa.textos?.length ? faixa.textos : [faixa.mensagem]).filter((texto: unknown) => typeof texto === 'string' && texto.trim()) as string[]
  const animacao = ['continuo', 'onda', 'piscar'].includes(faixa.animacao) ? faixa.animacao : 'continuo'
  if (!faixa.ativo || !textos[0]) return null
  const renderTextos = (prefix: string, repetitions = 1) => Array.from({ length: repetitions }, (_, repeat) => textos.map((t, i) => <span key={`${prefix}-${repeat}-${i}`}>{animacao === 'onda' ? [...t].map((c, j) => <i key={j} style={{ animationDelay: `${j * .04}s` }}>{c === ' ' ? '\u00a0' : c}</i>) : t}</span>))
  const velocidade = Math.max(4, Math.min(40, Number(faixa.velocidade) || 12))
  const marqueeStyle = { '--wd-marquee-duration': `${Math.max(18, 360 / velocidade)}s` } as CSSProperties
  const content = animacao === 'continuo'
    ? <div className="wd-announcement-track wd-announcement-continuo" style={marqueeStyle}><div className="wd-announcement-sequence">{renderTextos('a', 12)}</div><div className="wd-announcement-sequence" aria-hidden="true">{renderTextos('b', 12)}</div></div>
    : <div className={`wd-announcement-track wd-announcement-${animacao}`}>{renderTextos('single')}</div>
  const href = safeHttpLink(faixa.link)
  return href ? <a href={href} className="wd-announcement" style={{ background: faixa.corFundo, color: faixa.corTexto }}>{content}</a> : <div className="wd-announcement" style={{ background: faixa.corFundo, color: faixa.corTexto }}>{content}</div>
}function safeHttpLink(value: unknown){try{if(!value)return '';const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)?u.toString():''}catch{return ''}}
function scrollToSession(id:string){const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;document.getElementById(`sessao-${id}`)?.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'})}
function SecondaryStrip({ data }: { data:any }){if(!data.segundaFaixa?.ativo||!data.segundaFaixa.mensagem)return null;const href=safeHttpLink(data.segundaFaixa.link);const cls="wd-secondary-strip block rounded-xl px-4 py-3 mb-4 text-center font-semibold";return href?<a href={href} className={cls}>{data.segundaFaixa.mensagem}</a>:<div className={cls}>{data.segundaFaixa.mensagem}</div>}

export function CardapioCliente({ data }: { data: CardapioData }) {
  const [carrinho, setCarrinho] = useState<CartItem[]>([])
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [checkoutDireto, setCheckoutDireto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<any>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [itemEmEdicao, setItemEmEdicao] = useState<CartItem | null>(null)
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'inicio' | 'pedidos' | 'perfil'>('inicio')
  const [enderecoAberto, setEnderecoAberto] = useState(false)
  const [clienteLocal, setClienteLocal] = useState<any>({ nome: '', whatsapp: '', aniversario: '', endereco: '', numero: '', bairro: '', complemento: '', observacoes: '' })

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(`delivery_carrinho_${data.tenant.slug}`)
      if (salvo) setCarrinho(JSON.parse(salvo))
    } catch { /* armazenamento indisponivel */ }
  }, [data.tenant.slug])

  useEffect(() => {
    try {
      const key = `delivery_cliente_dados_${data.tenant.slug}`
      let salvo = localStorage.getItem(key)
      if (!salvo) { const legacy = localStorage.getItem('delivery_cliente_dados'); if (legacy) { const parsed = JSON.parse(legacy); if (parsed.tenantSlug === data.tenant.slug) { salvo = legacy; localStorage.setItem(key, legacy) } } }
      if (salvo) setClienteLocal((atual: any) => ({ ...atual, ...JSON.parse(salvo) }))
    } catch { /* noop */ }
  }, [data.tenant.slug])

  function salvarEnderecoCliente() {
    localStorage.setItem(`delivery_cliente_dados_${data.tenant.slug}`, JSON.stringify({ ...clienteLocal, tenantSlug: data.tenant.slug }))
    window.dispatchEvent(new Event('delivery-cliente-updated'))
    setEnderecoAberto(false)
  }

  useEffect(() => {
    try { localStorage.setItem(`delivery_carrinho_${data.tenant.slug}`, JSON.stringify(carrinho)) } catch { /* noop */ }
  }, [carrinho, data.tenant.slug])

  // Tracking de visita ao cardápio (1× por sessão)
  useEffect(() => {
    try {
      const chave = `visita_${data.tenant.slug}_${new Date().toDateString()}`
      if (typeof window !== 'undefined' && !sessionStorage.getItem(chave)) {
        sessionStorage.setItem(chave, '1')
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: data.tenant.slug,
            path: `/cardapio/${data.tenant.slug}`,
            referrer: document.referrer || null,
          }),
        }).catch(() => { /* silencioso */ })
      }
    } catch { /* noop */ }
  }, [data.tenant.slug])

  const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0)

  // Complementos por produto
  const complementosPorProduto = useMemo(() => {
    const map: Record<string, any[]> = {}
    data.produtoComplementos.forEach((pc: any) => {
      const complemento = data.complementos.find((c: any) => c.id === pc.complemento_id)
      if (complemento) {
        if (!map[pc.produto_id]) map[pc.produto_id] = []
        map[pc.produto_id].push(complemento)
      }
    })
    return map
  }, [data.produtoComplementos, data.complementos])

  const listasPorProduto = useMemo(() => {
    const map: Record<string, any[]> = {}
    Object.entries(complementosPorProduto).forEach(([produtoId, comps]) => {
      const ids = new Set((comps as any[]).map(c => c.categoria_id).filter(Boolean))
      map[produtoId] = data.listasComplementos
        .filter((l: any) => ids.has(l.id))
        .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
        .map((l: any) => ({ ...l, complementos: (comps as any[]).filter(c => c.categoria_id === l.id) }))
      const semLista = (comps as any[]).filter(c => !c.categoria_id)
      if (semLista.length) map[produtoId].push({ id: 'avulsos', nome: 'Adicionais', qtd_minima: 0, qtd_maxima: 99, complementos: semLista })
    })
    return map
  }, [complementosPorProduto, data.listasComplementos])

  // Filtro de busca
  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return data.produtos
    const b = busca.toLowerCase()
    return data.produtos.filter((p: any) =>
      p.nome.toLowerCase().includes(b) || (p.descricao && p.descricao.toLowerCase().includes(b))
    )
  }, [data.produtos, busca])

  function abrirModal(produto: any) {
    setItemEmEdicao(null)
    setProdutoSelecionado(produto)
    setModalAberto(true)
  }

  function editarItem(item: CartItem) {
    const produto = data.produtos.find((p: any) => p.id === item.produto_id)
    if (!produto) return
    setItemEmEdicao(item)
    setProdutoSelecionado(produto)
    setCarrinhoAberto(false)
    setModalAberto(true)
  }

  function substituirItem(itemId: string, item: Omit<CartItem, 'id'>) {
    setCarrinho(prev => prev.map(atual => atual.id === itemId ? { ...item, id: itemId } : atual))
    setItemEmEdicao(null)
  }

  function adicionarAoCarrinho(item: Omit<CartItem, 'id'>) {
    const novoItem: CartItem = {
      ...item,
      id: `${item.produto_id}-${Date.now()}`,
    }
    setCarrinho(prev => [...prev, novoItem])
  }

  function atualizarQuantidade(itemId: string, quantidade: number) {
    setCarrinho(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantidade } : item
      )
    )
  }

  function removerItem(itemId: string) {
    setCarrinho(prev => prev.filter(item => item.id !== itemId))
  }

  function limparCarrinho() {
    setCarrinho([])
  }

  // Variantes do produto selecionado
  const variantesDoProduto = useMemo(() => {
    if (!produtoSelecionado) return []
    return data.variantes.filter((v: any) => v.produto_id === produtoSelecionado.id)
  }, [produtoSelecionado, data.variantes])

  // Complementos do produto selecionado
  const complementosDoProduto = useMemo(() => {
    if (!produtoSelecionado) return []
    return complementosPorProduto[produtoSelecionado.id] || []
  }, [produtoSelecionado, complementosPorProduto])

  return (
    <div className={`cardapio-theme wd-font-${data.tipografia || 'classica'}`} style={{ background: data.theme.background, color: data.theme.text, '--cardapio-primary': data.theme.primary, '--cardapio-secondary': data.theme.secondary, '--cardapio-accent': data.theme.accent, '--cardapio-background': data.theme.background, '--cardapio-surface': data.theme.surface, '--cardapio-text': data.theme.text, '--cardapio-muted': data.theme.muted, '--cardapio-button': data.theme.button } as React.CSSProperties}>
      <AnnouncementStrip faixa={data.faixaAvisos} />
      {data.layout === 'moderno' ? (
        <LayoutModerno
          data={data}
          busca={busca}
          setBusca={setBusca}
          totalItens={totalItens}
          produtosFiltrados={produtosFiltrados}
          onAbrirModal={abrirModal}
          onAbrirCarrinho={() => { setCheckoutDireto(false); setCarrinhoAberto(true) }}
          enderecoCliente={clienteLocal.endereco ? `${clienteLocal.endereco}${clienteLocal.numero ? `, ${clienteLocal.numero}` : ''}` : ''}
          onEditarEndereco={() => setEnderecoAberto(true)}
        />
      ) : data.layout === 'minimalista' ? (
        <LayoutMinimalista
          data={data}
          busca={busca}
          setBusca={setBusca}
          totalItens={totalItens}
          produtosFiltrados={produtosFiltrados}
          onAbrirModal={abrirModal}
          onAbrirCarrinho={() => { setCheckoutDireto(false); setCarrinhoAberto(true) }}
          enderecoCliente={clienteLocal.endereco ? `${clienteLocal.endereco}${clienteLocal.numero ? `, ${clienteLocal.numero}` : ''}` : ''}
          onEditarEndereco={() => setEnderecoAberto(true)}
        />
      ) : (
        <LayoutClassico
          data={data}
          busca={busca}
          setBusca={setBusca}
          categoriaAtiva={categoriaAtiva}
          setCategoriaAtiva={setCategoriaAtiva}
          abaAtiva={abaAtiva}
          setAbaAtiva={setAbaAtiva}
          enderecoCliente={clienteLocal.endereco ? `${clienteLocal.endereco}${clienteLocal.numero ? `, ${clienteLocal.numero}` : ''}` : ''}
          onEditarEndereco={() => setEnderecoAberto(true)}
          totalItens={totalItens}
          produtosFiltrados={produtosFiltrados}
          onAbrirModal={abrirModal}
          onAbrirCarrinho={() => { setCheckoutDireto(false); setCarrinhoAberto(true) }}
          clienteLocal={clienteLocal}
          setClienteLocal={setClienteLocal}
        />
      )}

      <CheckoutDrawer
        isOpen={carrinhoAberto}
        startAtCustomer={checkoutDireto}
        onClose={() => setCarrinhoAberto(false)}
        itens={carrinho}
        onUpdateQuantity={atualizarQuantidade}
        onRemoveItem={removerItem}
        onEditItem={editarItem}
        onLimparCarrinho={limparCarrinho}
        tenantId={data.tenant.id}
        tenantSlug={data.tenant.slug}
        tenantNome={data.tenant.nome}
        tenantTelefone={data.tenant.telefone}
        tenantEndereco={data.tenant.endereco}
        enderecos={data.enderecos}
        formasPagamento={data.formasPagamento}
        entregaConfig={data.entregaConfig}
        valorMinimoPedido={data.valorMinimoPedido}
        onClienteCadastrado={(cliente) => setClienteLocal((current: any) => ({ ...current, ...cliente }))}
      />

      <ProdutoModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        produto={produtoSelecionado}
        variantes={variantesDoProduto}
        complementos={complementosDoProduto}
        listas={produtoSelecionado ? listasPorProduto[produtoSelecionado.id] || [] : []}
        onAddToCart={adicionarAoCarrinho}
        onGoToCheckout={() => { setCheckoutDireto(true); setCarrinhoAberto(true) }}
        paletaCor={data.corPaleta}
        initialItem={itemEmEdicao}
        onReplaceItem={substituirItem}
      />
      <FloatingWhatsApp data={data} />
      {enderecoAberto && <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setEnderecoAberto(false)}>
        <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <h2 className="text-xl font-bold text-gray-900">Seu endereço</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">Ficará salvo neste navegador para as próximas compras.</p>
          <div className="space-y-3">
            <input className="w-full border rounded-xl p-3" placeholder="Rua ou avenida" value={clienteLocal.endereco} onChange={(e) => setClienteLocal({ ...clienteLocal, endereco: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full border rounded-xl p-3" placeholder="Número" value={clienteLocal.numero} onChange={(e) => setClienteLocal({ ...clienteLocal, numero: e.target.value })} />
              <select className="w-full border rounded-xl p-3" value={clienteLocal.bairro} onChange={(e) => setClienteLocal({ ...clienteLocal, bairro: e.target.value })}>
                <option value="">Bairro</option>
                {data.enderecos.map((item: any) => <option key={item.id} value={item.bairro}>{item.bairro}</option>)}
              </select>
            </div>
            <input className="w-full border rounded-xl p-3" placeholder="Complemento ou referência" value={clienteLocal.complemento} onChange={(e) => setClienteLocal({ ...clienteLocal, complemento: e.target.value })} />
          </div>
          <div className="flex gap-3 mt-5">
            <button className="flex-1 border rounded-xl p-3" onClick={() => setEnderecoAberto(false)}>Cancelar</button>
            <button className="flex-1 rounded-xl p-3 text-white font-semibold" style={{ background: data.theme.primary }} onClick={salvarEnderecoCliente} disabled={!clienteLocal.endereco.trim()}>Salvar endereço</button>
          </div>
        </div>
      </div>}
      <div className="max-w-6xl mx-auto px-4"><PublicReviews slug={data.tenant.slug} /></div>
    </div>
  )
}

// ============================================================
// LAYOUT MINIMALISTA — Açaí TYPE (Web-style clean)
// ============================================================
function LayoutMinimalista({ data, busca, setBusca, totalItens, produtosFiltrados, onAbrirModal, onAbrirCarrinho, enderecoCliente, onEditarEndereco }: any) {
  const cor = data.theme.primary
  const whatsapp = '#25D366'

  const [tab, setTab] = useState<'topo' | 'monte' | 'combos'>('topo')

  // Agrupa produtos por categoria
  const porCategoria = data.categorias.map((cat: any) => ({
    ...cat,
    produtos: produtosFiltrados.filter((p: any) => p.categoria_id === cat.id)
  })).filter((c: any) => c.produtos.length > 0)

  return (
    <div className="min-h-screen" style={{ background: data.theme.background, color: data.theme.text }}>
      {/* Top bar verde WhatsApp */}
      <div className="hidden" style={{ background: cor }}>
        FAÇA SEU PEDIDO AGORA!
      </div>

      <StoreIdentity data={data} totalItens={totalItens} onAbrirCarrinho={onAbrirCarrinho} enderecoCliente={enderecoCliente} onEditarEndereco={onEditarEndereco} />
      {/* Header legado preservado apenas como estrutura de busca */}
      <header className="hidden bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl overflow-hidden">
              {data.tenant.logo_url && <img src={data.tenant.logo_url} alt={`Logo de ${data.tenant.nome}`} className="absolute inset-0 w-full h-full object-contain bg-white z-10" />}
              🍇
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.tenant.nome}</h1>
              <span className="hidden">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Fechado · {data.horario.abre}-{data.horario.fechar || data.horario.fecha}
              </span>
            </div>
          </div>
          <button onClick={onAbrirCarrinho} className="relative">
            <ShoppingCart className="w-6 h-6 text-gray-700" />
            {totalItens > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center px-1">
                {totalItens}
              </span>
            )}
          </button>
        </div>

        {/* WhatsApp + Search */}
        <div className="hidden">
          <a
            href={`https://wa.me/55${data.tenant.telefone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg mb-3 text-sm"
          >
            <span className="text-lg">📱</span> WhatsApp
          </a>
          <div className="flex gap-2">
            <div className="flex-1 relative border border-gray-200 rounded-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Digite para buscar um item"
                className="w-full bg-transparent py-2.5 pl-10 pr-4 text-sm outline-none text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <button className="w-12 h-12 rounded-lg flex items-center justify-center text-white" style={{ background: cor }}>
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="hidden">
        {[
          { id: 'topo', label: 'Topo' },
          { id: 'monte', label: 'Monte do seu Jeito!' },
          { id: 'combos', label: 'Combos' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className="flex items-center gap-1 text-sm font-medium px-1 py-1"
            style={{ color: tab === t.id ? cor : '#9CA3AF' }}
          >
            <span className="text-xs">◀</span>
            <span className={tab === t.id ? 'underline' : ''}>{t.label}</span>
            <span className="text-xs">▶</span>
          </button>
        ))}
      </div>

      {/* Aviso loja fechada */}
      {!data.lojaAberta && (
        <div className="hidden">
          <div className="p-4 rounded-lg border-2 border-dashed border-red-300 bg-red-50 flex items-center gap-3">
            <span className="text-2xl">🕐</span>
            <div>
              <p className="font-semibold text-red-700">Loja Fechada</p>
              <p className="text-sm text-red-600">Voltamos em breve!</p>
            </div>
          </div>
        </div>
      )}

      {/* Banner campanha */}
      <div className="hidden">
        <div className="rounded-xl overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white text-center">
          <p className="text-lg font-bold">Conheça o açaí que apaixona</p>
          <p className="text-2xl font-bold italic">corações.</p>
          <p className="text-xs mt-2">@typeaçaí</p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-32">
        <StoreActions data={data} />
        <SecondaryStrip data={data}/>
        <BannerCarousel banners={data.tenant.banners || []} fallback={<></>} />
        {/* Categorias e produtos */}
        {porCategoria.map((categoria: any) => (
          <section id={`sessao-${categoria.id}`} key={categoria.id} className="mb-8 scroll-mt-4">
            <div className="bg-gray-100 rounded-t-lg px-4 py-2 mb-0">
              <h2 className="text-base font-bold text-gray-900 text-center">{categoria.nome}</h2>
            </div>
            <div className="divide-y divide-gray-200 border border-gray-200 border-t-0 rounded-b-lg">
              {categoria.produtos.map((produto: any) => (
                <div key={produto.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-all">
                  {/* Miniatura */}
                  <button
                    onClick={() => onAbrirModal(produto)}
                    className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
                  >
                    {produto.imagem_url ? (
                      <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🍇</div>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold mb-1">
                      + Mais Pedido
                    </span>
                    <h3
                      className="font-semibold text-sm text-gray-900 cursor-pointer hover:text-orange-500"
                      onClick={() => onAbrirModal(produto)}
                    >
                      {produto.nome}
                    </h3>
                    {produto.descricao && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                        {produto.descricao}
                      </p>
                    )}
                    <ProductTags produto={produto} className="mt-1" />
                    <div className="flex items-center gap-3 mt-1">
                      <ProductPreco produto={produto} />
                      {produto.tempo_preparo_min && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {produto.tempo_preparo_min} min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botão Pedir */}
                  <button
                    onClick={() => onAbrirModal(produto)}
                    className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-lg flex-shrink-0"
                  >
                    Pedir
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}

        {(!data.categorias || data.categorias.length === 0 || data.produtos.length === 0) && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🍽️</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cardápio vazio</h2>
            <p className="text-gray-500">O estabelecimento ainda não cadastrou produtos</p>
          </div>
        )}
      </main>
    </div>
  )
}

// ============================================================
// LAYOUT MODERNO — Crispy Chicken (Premium app, vermelho)
// ============================================================
function LayoutModerno({ data, busca, setBusca, totalItens, produtosFiltrados, onAbrirModal, onAbrirCarrinho, enderecoCliente, onEditarEndereco }: any) {
  const cor = data.theme.primary
  const corBg = data.theme.surface

  const comBadges = produtosFiltrados.map((p: any, i: number) => ({
    ...p,
    badge: i === 0 ? 'BESTSELLER' : i === 1 ? 'POPULAR' : i === 2 ? 'SAVE 15%' : null
  }))

  return (
    <div className="min-h-screen" style={{ background: corBg }}>
      <div className="max-w-lg mx-auto">
        <StoreIdentity data={data} totalItens={totalItens} onAbrirCarrinho={onAbrirCarrinho} enderecoCliente={enderecoCliente} onEditarEndereco={onEditarEndereco} />
        {/* Header legado */}
        <header className="hidden px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
              <span className="text-xl">☰</span>
            </button>
            <div className="text-center flex-1 flex flex-col items-center">
              {data.tenant.logo_url && <img src={data.tenant.logo_url} alt={`Logo de ${data.tenant.nome}`} className="size-12 rounded-full object-contain bg-white mb-1" />}
              <p className="text-xs text-gray-600">Hi, Food Lover! 👋</p>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Crispy. Juicy.<br />Always Delicious.
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                <Bell className="w-5 h-5 text-gray-700" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">3</span>
              </button>
              <button onClick={onAbrirCarrinho} className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-gray-700" />
                {totalItens > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">{totalItens}</span>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="hidden">
            <div className="flex-1 relative bg-white rounded-full shadow-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Search for your favorite food..."
                className="w-full bg-transparent py-3 pl-11 pr-4 text-sm outline-none text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <button
              className="w-12 h-12 rounded-full flex items-center justify-center text-white"
              style={{ background: cor }}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Aviso loja fechada */}
        {!data.lojaAberta && (
          <div className="hidden">
            <span className="text-2xl">🕐</span>
            <div>
              <p className="font-semibold text-red-700">Loja Fechada</p>
              <p className="text-sm text-red-600">Voltamos em breve!</p>
            </div>
          </div>
        )}

        <main className="px-4 py-2">
          <StoreActions data={data} />
          <SecondaryStrip data={data}/>
          {/* Banner Hero */}
          <BannerCarousel banners={data.tenant.banners || []} height="h-64" fallback={<div className="relative rounded-2xl overflow-hidden mb-6 h-64 bg-gradient-to-br from-red-900 to-red-700">
            <div className="absolute inset-0 flex items-center">
              <div className="p-6 text-white z-10 flex-1">
                <span className="inline-block px-2.5 py-1 rounded-full bg-red-600 text-xs font-bold mb-3">HOT & CRISPY</span>
                <p className="text-2xl font-bold mb-2 leading-tight">
                  Crave the<br />Crispy<br />Perfection!
                </p>
                <p className="text-xs opacity-90 mb-4">Hand-breaded. Freshly<br />cooked. Every time.</p>
                <button
                  className="px-5 py-2.5 rounded-full text-white font-semibold text-sm flex items-center gap-2"
                  style={{ background: cor }}
                >
                  Order Now →
                </button>
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-3/5 bg-cover bg-center"
              style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400)' }}
            />
            {/* Carousel dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span className="w-2 h-2 rounded-full bg-white/50" />
              <span className="w-2 h-2 rounded-full bg-white/50" />
              <span className="w-2 h-2 rounded-full bg-white/50" />
            </div>
          </div>} />

          {/* Categorias com avatares */}
          <section className="wd-minimal-category-tabs -mt-10 mb-1">
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {data.categorias.map((cat: any, i: number) => (
                <button
                  key={cat.id}
                  onClick={()=>scrollToSession(cat.id)}
                  className="wd-minimal-category-tab flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold"
                >
                  <div
                    className="hidden"
                    style={{ borderColor: i === 0 ? '#FCA5A5' : 'transparent' }}
                  >
                    {cat.imagem_url ? (
                      <img src={cat.imagem_url} alt={cat.nome} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{['🍔','🍕','🍟','🥤','🍰'][i % 5]}</span>
                    )}
                  </div>
                  <span>{cat.nome}</span>
                </button>
              ))}
            </div>
          </section>
          <div className="sr-only">{data.categorias.map((cat:any)=><span id={`sessao-${cat.id}`} key={cat.id}>{cat.nome}</span>)}</div>

          {/* Popular Combos */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Popular Combos</h2>
              <button className="text-sm font-medium flex items-center gap-1" style={{ color: cor }}>
                View All →
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {comBadges.slice(0, 5).map((produto: any) => (
                <button
                  key={produto.id}
                  onClick={() => onAbrirModal(produto)}
                  className="bg-white rounded-2xl overflow-hidden flex-shrink-0 w-44 text-left hover:shadow-xl transition-all active:scale-95 relative"
                >
                  {produto.badge && (
                    <span
                      className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                      style={{
                        background: produto.badge === 'BESTSELLER' ? '#DC2626' :
                                    produto.badge === 'POPULAR' ? '#F59E0B' : '#16A34A'
                      }}
                    >
                      {produto.badge}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center"
                  >
                    <span className="text-red-500">♡</span>
                  </button>
                  <div className="aspect-square bg-gray-100">
                    {produto.imagem_url ? (
                      <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🍔</div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm text-gray-900 leading-tight mb-1 line-clamp-2">{produto.nome}</h3>
                    <p className="text-xs text-gray-500 mb-2">{produto.descricao || 'Acompanha fries + drink'}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                      <span className="text-amber-500">★★★★★</span>
                      <span className="font-medium">{produto.rating || '4.8'}</span>
                      <span className="text-gray-400">({produto.reviews || '245'})</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <ProductPreco produto={produto} />
                      {produto.tempo_preparo_min && (
                        <span
                          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-red-50"
                          style={{ color: cor }}
                        >
                          <Clock className="w-3 h-3" />
                          {produto.tempo_preparo_min} min
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="text-xs text-gray-400 font-medium"
                      >
                        Adicionar
                      </button>
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                        style={{ background: cor }}
                      >
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Spicy Deals Banner */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-4 mb-6 flex items-center gap-3 border border-orange-100">
            <div className="flex-1">
              <p className="text-xs font-bold text-red-600 mb-1">Spicy Deals 🔥</p>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Up to 30% OFF</h3>
              <p className="text-xs text-gray-600 mb-2">On selected combos</p>
              <button
                className="px-4 py-2 rounded-full text-white font-semibold text-xs flex items-center gap-1"
                style={{ background: cor }}
              >
                Order Now →
              </button>
            </div>
            <div className="w-24 h-24 rounded-full bg-cover bg-center flex-shrink-0"
              style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200)' }}
            />
          </div>

          {/* Empty state */}
          {(!data.categorias || data.categorias.length === 0 || data.produtos.length === 0) && (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">🍽️</span>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Cardápio vazio</h2>
              <p className="text-gray-500">O estabelecimento ainda não cadastrou produtos</p>
            </div>
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-2 px-4 z-30 shadow-lg">
          <div className="max-w-lg mx-auto flex items-center justify-around">
            {[
              { id: 'home', icon: Home, label: 'Home' },
              { id: 'menu', icon: FileText, label: 'Menu' },
              { id: 'orders', icon: ShoppingBag, label: 'Orders' },
              { id: 'offers', icon: Search, label: 'Offers' },
              { id: 'profile', icon: User, label: 'Profile' },
            ].map((item) => (
              <button
                key={item.id}
                className="flex flex-col items-center gap-1 py-1 px-3"
                style={{
                  color: item.id === 'orders' ? cor : '#9CA3AF',
                  background: item.id === 'orders' ? '#FEE2E2' : 'transparent',
                  borderRadius: item.id === 'orders' ? '999px' : '0'
                }}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

// ============================================================
// LAYOUT CLÁSSICO — Sabor da Casa (App-style laranja)
// ============================================================
function LayoutClassico({ data, busca, setBusca, categoriaAtiva, setCategoriaAtiva, abaAtiva, setAbaAtiva, totalItens, produtosFiltrados, onAbrirModal, onAbrirCarrinho, enderecoCliente, onEditarEndereco, clienteLocal, setClienteLocal }: any) {
  const cor = data.theme.primary
  const corSecundaria = data.theme.secondary

  const produtosDaCategoria = categoriaAtiva
    ? produtosFiltrados.filter((produto: any) => produto.categoria_produto_id === categoriaAtiva)
    : produtosFiltrados

  return (
    <div className="wd-classic max-w-lg mx-auto min-h-screen pb-24" style={{ background: data.theme.background, color: data.theme.text }}>
      <StoreIdentity data={data} totalItens={totalItens} onAbrirCarrinho={onAbrirCarrinho} enderecoCliente={enderecoCliente} onEditarEndereco={onEditarEndereco} />
      {/* Header legado */}
      <header className="hidden px-4 pt-4 pb-2" style={{ background: data.theme.background }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full border-2 flex items-center justify-center overflow-hidden" style={{ borderColor: cor, background: data.theme.surface }}>
              {data.tenant.logo_url && <img src={data.tenant.logo_url} alt={`Logo de ${data.tenant.nome}`} className="absolute inset-0 w-full h-full object-contain bg-white z-10" />}
              <span className="text-2xl">🍴</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{data.tenant.nome}</h1>
              <span className={data.lojaAberta
                ? "text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium"
                : "text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"
              } style={{ display: 'none' }}>
                {data.lojaAberta ? 'Aberto' : 'Fechado'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative">
              <Bell className="w-6 h-6 text-gray-700" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: cor }} />
            </button>
            <button onClick={onAbrirCarrinho} className="relative">
              <ShoppingCart className="w-6 h-6 text-gray-700" />
              {totalItens > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center px-1">
                  {totalItens}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Endereço */}
        <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
          <MapPin className="w-4 h-4" style={{ color: cor }} />
          <span>Entregar em: </span>
          <button type="button" onClick={onEditarEndereco} className="flex items-center gap-1 font-medium max-w-[240px]" style={{ color: cor }}>
            <span className="truncate">{enderecoCliente || 'Seu endereço'}</span> <ChevronDown className="w-3 h-3 shrink-0" />
          </button>
        </div>

        {/* Search */}
        <div className="hidden">
          <div className="flex-1 relative bg-gray-100 rounded-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="O que você quer pedir hoje?"
              className="w-full bg-transparent py-3 pl-10 pr-4 text-sm outline-none text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <button
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
            style={{ background: cor }}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Aviso loja fechada */}
      {!data.lojaAberta && (
        <div className="hidden">
          <span className="text-2xl">🕐</span>
          <div>
            <p className="font-semibold text-red-700">Loja Fechada</p>
            <p className="text-sm text-red-600">Voltamos em breve!</p>
          </div>
        </div>
      )}

      {abaAtiva === 'pedidos' ? <CustomerOrders slug={data.tenant.slug} cliente={clienteLocal} /> : abaAtiva === 'perfil' ? <CustomerProfile slug={data.tenant.slug} cliente={clienteLocal} setCliente={setClienteLocal} /> : <main className="wd-content px-4 py-4">
        <StoreActions data={data} />
        <SecondaryStrip data={data}/>
        {/* Banner Hero */}
        <BannerCarousel banners={data.tenant.banners || []} fallback={<div className="wd-banner relative rounded-2xl overflow-hidden mb-6 h-56">
          <div className="absolute inset-0 flex items-center">
            <div className="p-6 text-white z-10 flex-1">
              <p className="text-xs font-semibold tracking-wider mb-2 opacity-90">COMBO DO DIA</p>
              <p className="text-4xl font-bold mb-4 leading-tight">20% OFF</p>
              <button
                className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: cor }}
              >
                Pedir agora
              </button>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-2/3 bg-cover bg-center opacity-90"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400)' }}
          />
          {/* Carousel dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span className="w-2 h-2 rounded-full bg-white/50" />
            <span className="w-2 h-2 rounded-full bg-white/50" />
          </div>
        </div>} />

        {/* Categorias */}
        {data.categorias.length > 0 && <section className="wd-category-shortcuts -mt-8 mb-0">
          <div className="flex items-center justify-between mb-4">
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {data.categorias.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => scrollToSession(cat.id)}
                className="wd-category-tile flex-shrink-0"
                aria-label={`Ir para ${cat.nome}`}
              >
                <div className="wd-session-shortcut flex items-center justify-center min-w-32 h-12 rounded-2xl px-4">
                  <span className="text-sm font-semibold truncate">{cat.nome}</span>
                </div>
              </button>
            ))}
          </div>
        </section>}

        {/* Sessões reais cadastradas pelo lojista */}
        {data.categorias.map((sessao: any) => {
          const produtosSessao = produtosDaCategoria.filter((produto: any) => produto.categoria_id === sessao.id)
          if (!produtosSessao.length) return null
          return <section id={`sessao-${sessao.id}`} className="mb-2 scroll-mt-4" key={sessao.id}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="wd-title text-2xl font-bold">{sessao.nome}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {produtosSessao.map((produto: any) => (
              <button
                key={produto.id}
                onClick={() => onAbrirModal(produto)}
              className="wd-product-card rounded-3xl overflow-hidden text-left hover:shadow-lg transition-all active:scale-95"
              >
                <div className="wd-product-image aspect-square relative overflow-hidden rounded-t-3xl bg-white">
                  {produto.imagem_url ? (
                    <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full transition-transform duration-300 hover:scale-105" style={{ objectFit: 'cover', objectPosition: 'center' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">🍔</div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="wd-title font-bold text-sm leading-tight mb-1">{produto.nome}</h3>
                  {produto.descricao && (
                    <p className="wd-description text-xs line-clamp-2 mb-2">{produto.descricao}</p>
                  )}
                  <ProductTags produto={produto} className="mb-2" />
                  <div className="flex items-center gap-2 mb-2">
                    <ProductPreco produto={produto} />
                    {produto.tempo_preparo_min && (
                      <span
                        className="wd-time inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                      >
                        <Clock className="w-3 h-3" />
                        {produto.tempo_preparo_min} min
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="wd-description text-xs font-medium"
                    >
                      Toque para +
                    </button>
                    <span
                      className="wd-cta w-7 h-7 rounded-full flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>})}

        {/* Empty state */}
        {(!data.categorias || data.categorias.length === 0 || data.produtos.length === 0) && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🍽️</span>
            <h2 className="wd-title text-xl font-bold mb-2">Cardápio vazio</h2>
            <p className="wd-description">O estabelecimento ainda não cadastrou produtos</p>
          </div>
        )}
      </main>}

      {/* Bottom Nav */}
      <nav className="wd-bottom-nav fixed bottom-0 left-0 right-0 px-4 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          {[
            { id: 'inicio', icon: Home, label: 'Início' },
            { id: 'pedidos', icon: ShoppingBag, label: 'Pedidos' },
            { id: 'perfil', icon: User, label: 'Perfil' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setAbaAtiva(item.id)}
              aria-current={abaAtiva === item.id ? 'page' : undefined}
              className="flex min-h-11 flex-col items-center justify-center gap-1 px-3"
              style={{ color: abaAtiva === item.id ? cor : data.theme.secondary }}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}


















