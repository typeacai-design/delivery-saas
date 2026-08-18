'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import {
  Plus, Edit, Trash2, Image as ImageIcon, Check, X, Save,
  Palette, Layout as LayoutIcon, Sparkles, Utensils as UtensilsIcon,
  Package, AlertCircle, Tag, Clock, Upload
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import ProdutoFormModal from '@/components/admin/ProdutoFormModal'
import ComplementosTab from '@/components/admin/ComplementosTab'
import ProdutoLinha from '@/components/admin/ProdutoLinha'
import { getCardapioTheme } from '@/lib/cardapio-theme'

type Tab = 'design' | 'produtos' | 'complementos'
type ColorKey = 'primary' | 'secondary' | 'accent'
const HEX_COLOR = /^#[0-9A-F]{6}$/i
function normalizeHex(value: string) { return value.toUpperCase().slice(0, 7) }
function HexColorField(p:{label:string;value:string;onChange:(v:string)=>void}) { const ok=HEX_COLOR.test(p.value); return <label className="text-sm font-medium"><span>{p.label}</span><div className="flex gap-2 mt-1"><input type="color" className="w-12 h-11 p-1" value={ok?p.value:'#000000'} onChange={e=>p.onChange(e.target.value.toUpperCase())}/><input type="text" className={ok?'font-mono uppercase':'font-mono uppercase border-red-500'} value={p.value} maxLength={7} placeholder="#FFFFFF" onChange={e=>p.onChange(normalizeHex(e.target.value))}/></div>{ok?null:<span className="text-xs text-red-600">Codigo HEX invalido.</span>}</label> }

const PALETAS_FICTICIAS = [
  {
    id: 'verde-classica',
    nome: 'Verde Clássica',
    bg: '#FFFFFF',
    primary: '#16A34A',
    surface: '#F0FDF4',
    text: '#0A0A0A'
  },
  {
    id: 'quente-laranja',
    nome: 'Quente Laranja',
    bg: '#FFFBEB',
    primary: '#EA580C',
    surface: '#FED7AA',
    text: '#7C2D12'
  },
  {
    id: 'azul-marinho',
    nome: 'Azul Marinho',
    bg: '#FFFFFF',
    primary: '#1E40AF',
    surface: '#DBEAFE',
    text: '#0F172A'
  },
]

export default function CardapioPage() {
  const [tab, setTab] = useState<Tab>('design')
  const supabase = createClient()

  const tabs = [
    { id: 'design', label: 'Design', icon: Palette },
    { id: 'produtos', label: 'Produtos', icon: UtensilsIcon },
    { id: 'complementos', label: 'Complementos', icon: Package },
  ] as const

  return (
    <div>
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Sparkles size={11} />
            Cardapio publico
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
            Cardapio
          </h1>
          <p className="hint mt-2">Design, produtos e adicionais</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
        {tabs.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition whitespace-nowrap"
              style={
                active
                  ? {
                      background: 'var(--green)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,.3)',
                      boxShadow: '0 0 24px -4px rgba(22,163,74,.5)',
                    }
                  : {
                      background: 'rgba(255,255,255,.7)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-muted)',
                      backdropFilter: 'blur(8px)',
                    }
              }
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'design' && <DesignTab />}
      {tab === 'produtos' && <ProdutosTab />}
      {tab === 'complementos' && <ComplementosTab />}
    </div>
  )
}

function DesignTab() {
  const [paleta, setPaleta] = useState('verde-classica')
  const [layout, setLayout] = useState('classico')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [whatsapp, setWhatsapp] = useState({ ativo: true, numero: '', mensagem: 'Ola! Estou no seu site e preciso de ajuda.' })
  const [aviso, setAviso] = useState({ ativo: false, mensagem: '', fundo: '#111827', texto: '#FFFFFF', link: '' })
  const [faixas, setFaixas] = useState({ topoTextos: '', topoAnimacao: 'continuo', velocidade: 12, segundaAtiva: false, segundaMensagem: '', segundaLink: '' })
  const [cores, setCores] = useState<Record<ColorKey,string>>({ primary: '#16A34A', secondary: '#15803D', accent: '#F97316' })
  const [tipografia, setTipografia] = useState<'classica' | 'moderna' | 'minimalista'>('classica')

  useEffect(() => { (async () => {
    const response = await fetch('/api/cardapio/design', { cache: 'no-store' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage({ type: 'error', text: result.error || 'Nao foi possivel carregar o design.' }); setLoading(false); return }
    const tenantData = result.tenant; setTenant(tenantData)
    const cfg = (tenantData?.config || {}) as any
    if (cfg.cardapio_layout) setLayout(cfg.cardapio_layout)
    if (cfg.cardapio_paleta) setPaleta(cfg.cardapio_paleta)
    if (cfg.cardapio_cores) setCores((atual) => ({ primary: cfg.cardapio_cores.primary || atual.primary, secondary: cfg.cardapio_cores.secondary || atual.secondary, accent: cfg.cardapio_cores.accent || atual.accent }))
    if (['classica','moderna','minimalista'].includes(cfg.cardapio_tipografia)) setTipografia(cfg.cardapio_tipografia)
    setWhatsapp({ ativo: cfg.cardapio_whatsapp_ativo !== false, numero: cfg.cardapio_whatsapp_numero || '', mensagem: cfg.cardapio_whatsapp_mensagem || 'Ola! Estou no seu site e preciso de ajuda.' })
    setAviso({ ativo: cfg.cardapio_aviso_ativo === true, mensagem: cfg.cardapio_aviso_mensagem || '', fundo: cfg.cardapio_aviso_fundo || '#111827', texto: cfg.cardapio_aviso_texto || '#FFFFFF', link: cfg.cardapio_aviso_link || '' })
    setFaixas({ topoTextos: Array.isArray(cfg.cardapio_aviso_textos) ? cfg.cardapio_aviso_textos.join('\n') : (cfg.cardapio_aviso_mensagem || ''), topoAnimacao: cfg.cardapio_aviso_animacao || 'continuo', velocidade: Number(cfg.cardapio_aviso_velocidade || 12), segundaAtiva: cfg.cardapio_segunda_faixa_ativa === true, segundaMensagem: cfg.cardapio_segunda_faixa_mensagem || '', segundaLink: cfg.cardapio_segunda_faixa_link || '' })
    const banners = Array.isArray(cfg.cardapio_banners) ? cfg.cardapio_banners : []
    setTenant({ ...tenantData, banners: [0, 1, 2].map((i) => banners[i]?.url || (i === 0 ? tenantData.banner_url : '') || '') })
    setLoading(false)
  })() }, [])

  const salvarDesign = async () => {
    setSaving(true); setMessage(null)
    try {
      if ([...Object.values(cores), aviso.fundo, aviso.texto].some((cor) => !HEX_COLOR.test(cor))) throw new Error('Revise as cores em formato HEX.')
      const config = { cardapio_layout: layout, cardapio_paleta: paleta, cardapio_cores: cores, cardapio_tipografia: tipografia, cardapio_whatsapp_ativo: whatsapp.ativo, cardapio_whatsapp_numero: whatsapp.numero, cardapio_whatsapp_mensagem: whatsapp.mensagem, cardapio_aviso_ativo: aviso.ativo, cardapio_aviso_mensagem: aviso.mensagem, cardapio_aviso_textos: faixas.topoTextos.split('\n').map((v) => v.trim()).filter(Boolean), cardapio_aviso_animacao: faixas.topoAnimacao, cardapio_aviso_velocidade: faixas.velocidade, cardapio_aviso_fundo: aviso.fundo, cardapio_aviso_texto: aviso.texto, cardapio_aviso_link: aviso.link, cardapio_segunda_faixa_ativa: faixas.segundaAtiva, cardapio_segunda_faixa_mensagem: faixas.segundaMensagem, cardapio_segunda_faixa_link: faixas.segundaLink }
      const r = await fetch('/api/cardapio/design', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) }); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || 'Nao foi possivel salvar o design.')
      const rv = await fetch('/api/revalidate-cardapio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: b.slug }) }); if (!rv.ok) throw new Error('Design salvo, mas a atualizacao publica falhou.')
      setSaved(true); setMessage({ type: 'ok', text: 'Design salvo e cardapio publico atualizado.' }); setTimeout(() => setSaved(false), 2000)
    } catch (error: any) { setMessage({ type: 'error', text: error.message || 'Erro ao salvar o design.' }) } finally { setSaving(false) }
  }

  if (loading) return <div className="text-center py-8 hint">Carregando...</div>
  return <div className="space-y-5">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <AssetUpload tipo="logo" titulo="Logomarca do negocio" url={tenant?.logo_url || ''} onChanged={(url) => setTenant((t: any) => ({ ...t, logo_url: url }))} slug={tenant?.slug} />
      {[0,1,2].map((slot) => <AssetUpload key={slot} tipo="banner" slot={slot} titulo={'Banner principal ' + (slot + 1)} url={tenant?.banners?.[slot] || ''} onChanged={(url) => setTenant((t: any) => { const banners = [...(t?.banners || ['', '', ''])]; banners[slot] = url; return { ...t, banners } })} slug={tenant?.slug} />)}
    </div>
    <div className="glass p-6 space-y-4"><div className="eyebrow">Aparencia</div><h2 className="text-lg font-semibold">Layout do cardapio</h2><div className="grid md:grid-cols-3 gap-3">{[{id:'classico',nome:'Classico',desc:'Layout completo'},{id:'moderno',nome:'Moderno',desc:'Visual contemporaneo',disabled:true},{id:'minimalista',nome:'Minimalista',desc:'Visual limpo',disabled:true}].map((l) => <button key={l.id} disabled={l.disabled} onClick={() => setLayout(l.id)} className="text-left p-4 rounded-2xl border" style={{ opacity: l.disabled ? .5 : 1, borderColor: layout === l.id ? 'var(--green)' : 'var(--line)' }}><b>{l.nome}</b><div className="hint text-xs">{l.desc}</div></button>)}</div></div>
    <div className="glass p-6 space-y-4"><div className="eyebrow">Atendimento</div><h2 className="text-lg font-semibold">Botao do WhatsApp</h2><label className="flex items-center gap-2"><input type="checkbox" checked={whatsapp.ativo} onChange={(e) => setWhatsapp({ ...whatsapp, ativo: e.target.checked })} /> Ativar botao</label><div className="grid md:grid-cols-2 gap-3"><input value={whatsapp.numero} onChange={(e) => setWhatsapp({ ...whatsapp, numero: e.target.value })} placeholder="Numero com DDD" /><input value={whatsapp.mensagem} onChange={(e) => setWhatsapp({ ...whatsapp, mensagem: e.target.value })} placeholder="Mensagem predefinida" /></div>{whatsapp.ativo && <div className="rounded-xl p-3 bg-green-500 text-white text-center font-semibold">WhatsApp - {whatsapp.mensagem}</div>}</div>
    <div className="glass p-6 space-y-4"><div className="eyebrow">Comunicacao</div><h2 className="text-lg font-semibold">Faixa de avisos</h2><label className="flex items-center gap-2"><input type="checkbox" checked={aviso.ativo} onChange={(e) => setAviso({ ...aviso, ativo: e.target.checked })} /> Ativar faixa</label><input value={aviso.mensagem} onChange={(e) => setAviso({ ...aviso, mensagem: e.target.value })} placeholder="Mensagem principal" /><textarea rows={3} value={faixas.topoTextos} onChange={(e) => setFaixas({ ...faixas, topoTextos: e.target.value })} placeholder="Textos do topo, um por linha" /><div className="grid md:grid-cols-2 gap-3"><label>Animacao<select value={faixas.topoAnimacao} onChange={(e) => setFaixas({ ...faixas, topoAnimacao: e.target.value })}><option value="continuo">Continuo</option><option value="onda">Onda</option><option value="piscar">Piscar</option></select></label><label>Velocidade ({faixas.velocidade}s)<input type="range" min="4" max="30" value={faixas.velocidade} onChange={(e) => setFaixas({ ...faixas, velocidade: Number(e.target.value) })} /></label></div><label className="flex items-center gap-2"><input type="checkbox" checked={faixas.segundaAtiva} onChange={(e) => setFaixas({ ...faixas, segundaAtiva: e.target.checked })} /> Ativar segunda faixa</label><input value={faixas.segundaMensagem} onChange={(e) => setFaixas({ ...faixas, segundaMensagem: e.target.value })} placeholder="Mensagem da segunda faixa" /><input value={faixas.segundaLink} onChange={(e) => setFaixas({ ...faixas, segundaLink: e.target.value })} placeholder="Link opcional" /><div className="grid md:grid-cols-3 gap-3"><HexColorField label="Cor do fundo" value={aviso.fundo} onChange={(fundo) => setAviso({ ...aviso, fundo })} /><HexColorField label="Cor do texto" value={aviso.texto} onChange={(texto) => setAviso({ ...aviso, texto })} /><input value={aviso.link} onChange={(e) => setAviso({ ...aviso, link: e.target.value })} placeholder="Link opcional" /></div></div>
    <div className="glass p-6 space-y-4">
      <div className="eyebrow">Identidade</div>
      <h2 className="text-lg font-semibold">Cores personalizadas e tipografia</h2>
      <p className="hint text-xs">A previa abaixo acompanha instantaneamente suas escolhas.</p>
      <div className="grid md:grid-cols-3 gap-3">{([{id:'classica',nome:'Classica',fonte:'Playfair Display / Lato'},{id:'moderna',nome:'Moderna',fonte:'Poppins / Inter'},{id:'minimalista',nome:'Minimalista',fonte:'Montserrat'}] as const).map((op) => <button type="button" key={op.id} onClick={() => setTipografia(op.id)} className="text-left p-3 rounded-xl border" style={{ borderColor: tipografia === op.id ? cores.primary : 'var(--line)', background: tipografia === op.id ? cores.primary + '12' : 'white' }}><b>{op.nome}</b><span className="block text-xs opacity-70">{op.fonte}</span></button>)}</div>
      <div className="grid md:grid-cols-3 gap-4">{(['primary','secondary','accent'] as const).map((key) => <HexColorField key={key} label={key} value={cores[key]} onChange={(value) => setCores({ ...cores, [key]: normalizeHex(value) })} />)}</div>
      {(() => { const preview = getCardapioTheme(paleta, cores); return <div className={'mt-4 rounded-2xl overflow-hidden border wd-font-' + tipografia} style={{ background: preview.background, color: preview.text, borderColor: preview.secondary }}>
        <div className="p-5" style={{ background: preview.primary, color: '#fff' }}><div className="text-xs uppercase tracking-wider opacity-80">Previa do seu cardapio</div><div className="text-2xl font-bold mt-1" style={{ fontFamily: tipografia === 'classica' ? 'Georgia, serif' : tipografia === 'moderna' ? 'Arial, sans-serif' : 'Verdana, sans-serif' }}>Sua loja</div><div className="text-sm opacity-90">Identidade visual aplicada em tempo real</div></div>
        <div className="p-5 space-y-3"><div className="flex items-center justify-between"><span className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: preview.accent, color: preview.text }}>DESTAQUE</span><span className="text-sm" style={{ color: preview.secondary }}>Aberto agora</span></div><div><h3 className="text-xl font-bold" style={{ fontFamily: tipografia === 'classica' ? 'Georgia, serif' : tipografia === 'moderna' ? 'Arial, sans-serif' : 'Verdana, sans-serif' }}>Produto especial</h3><p className="text-sm opacity-70">Descricao, categorias e produtos usam sua identidade.</p></div><div className="flex items-center justify-between"><b className="text-lg" style={{ color: preview.secondary }}>R$ 29,90</b><button className="px-4 py-2 rounded-xl text-white font-semibold" style={{ background: preview.button }}>Adicionar</button></div></div>
      </div> })()}
    </div>    <button onClick={salvarDesign} disabled={saving} className="btn-primary w-full justify-center">{saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar design'}</button>{message && <div className="text-sm text-center p-3 rounded-2xl">{message.text}</div>}
  </div>
}

function AssetUpload({ tipo, titulo, url, onChanged, slug, slot = 0 }: { tipo: 'logo' | 'banner'; titulo: string; url: string; onChanged: (url: string) => void; slug?: string; slot?: number }) {
  const [uploading, setUploading] = useState(false); const [error, setError] = useState('')
  const upload = async (file: File) => { setError(''); if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return setError('Use JPG, PNG ou WebP.'); if (file.size > 5 * 1024 * 1024) return setError('A imagem deve ter no maximo 5MB.'); setUploading(true); try { const form = new FormData(); form.append('file', file); form.append('tipo', tipo); form.append('slot', String(slot)); const response = await fetch('/api/upload-cardapio-asset', { method: 'POST', body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Erro no upload'); onChanged(result.url); if (slug) await fetch('/api/revalidate-cardapio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }) } catch (e: any) { setError(e.message) } finally { setUploading(false) } }
  const inputId = 'cardapio-' + tipo + '-' + slot + '-input'
  return <div className="glass p-6"><div className="eyebrow mb-1">Identidade visual</div><h2 className="text-lg font-semibold mb-4">{titulo}</h2><button type="button" onClick={() => document.getElementById(inputId)?.click()} className="w-full min-h-36 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden">{url ? <img src={url} alt={titulo} className={tipo === 'banner' ? 'w-full h-40 object-cover' : 'size-28 object-contain'} /> : <span className="hint">{uploading ? 'Enviando...' : 'Clique para enviar'}</span>}</button><input id={inputId} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = '' }} />{url && <button type="button" onClick={async () => { setUploading(true); const r = await fetch('/api/upload-cardapio-asset?tipo=' + tipo + '&slot=' + slot, { method: 'DELETE' }); if (r.ok) onChanged(''); setUploading(false) }} disabled={uploading} className="mt-3 text-sm text-red-600">Remover imagem</button>}{error && <p className="text-sm text-red-600 mt-2">{error}</p>}<p className="hint text-xs mt-2">{tipo === 'banner' ? '1080 x 600 px' : '1080 x 1080 px'} - JPG, PNG ou WebP - ate 5MB.</p></div>
}
function ProdutosTab() {
  const [categorias, setCategorias] = useState<any[]>([])
  const [categoriasProduto, setCategoriasProduto] = useState<any[]>([])
  const [produtos, setProdutos] = useState<Record<string, any[]>>({})
  const [complementosPorProduto, setComplementosPorProduto] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showProdModal, setShowProdModal] = useState(false)
  const [novaCat, setNovaCat] = useState('')
  const [novaCatBanner, setNovaCatBanner] = useState('')

  const [editingProduto, setEditingProduto] = useState<any>(null)
  const [editingCat, setEditingCat] = useState<any>(null)
  const [showTipoModal, setShowTipoModal] = useState(false)
  const [novoTipo, setNovoTipo] = useState('')
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) { setLoading(false); return }
    const tid = await activeTenantId()
    if (!tid) return

    const { data: cats } = await supabase
      .from('categorias')
      .select('*')
      .eq('tenant_id', tid)
      .eq('ativo', true)
      .order('ordem')
    setCategorias(cats || [])
    const { data: tipos } = await supabase.from('categorias_produtos').select('*').eq('tenant_id', tid).eq('ativo', true).order('ordem')
    setCategoriasProduto(tipos || [])

    if (cats) {
      const prods: Record<string, any[]> = {}
      for (const cat of cats) {
        const { data: p } = await supabase
          .from('produtos')
          .select('*')
          .eq('tenant_id', tid)
          .eq('categoria_id', cat.id)
          .eq('ativo', true)
          .order('ordem')
        prods[cat.id] = p || []
      }
      setProdutos(prods)

      // Mapear quantidade de complementos por produto
      const ids = Object.values(prods).flat().map((p: any) => p.id)
      if (ids.length > 0) {
        const { data: pcs } = await supabase
          .from('produto_complementos')
          .select('produto_id')
          .in('produto_id', ids)
        const map: Record<string, any[]> = {}
        pcs?.forEach((r: any) => {
          if (!map[r.produto_id]) map[r.produto_id] = []
          map[r.produto_id].push(r)
        })
        setComplementosPorProduto(map)
      }
    }
    setLoading(false)
  }

  const criarCategoria = async () => {
    if (!novaCat.trim()) return
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    await supabase.from('categorias').insert({
      tenant_id: await activeTenantId(),
      nome: novaCat,
      ordem: categorias.length,
      imagem_url: novaCatBanner.trim() || null,
    })
    setNovaCat('')
    setShowCatModal(false)
    setEditingCat(null)
    loadData()
  }

  const criarTipoProduto = async () => {
    if (!novoTipo.trim()) return
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { error } = await supabase.from('categorias_produtos').insert({ tenant_id: await activeTenantId(), nome: novoTipo.trim(), ordem: categoriasProduto.length })
    if (error) return alert(`Não foi possível criar a categoria: ${error.message}`)
    setNovoTipo('')
    setShowTipoModal(false)
    loadData()
  }

  const atualizarCategoria = async () => {
    if (!editingCat || !novaCat.trim()) return
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    await supabase
      .from('categorias')
      .update({ nome: novaCat, imagem_url: novaCatBanner.trim() || null })
      .eq('id', editingCat.id)
    setNovaCat('')
    setShowCatModal(false)
    setEditingCat(null)
    loadData()
  }

  const deletarCategoria = async (id: string) => {
    if (!confirm('Tem certeza? Produtos desta categoria ficarão sem categoria.')) return
    await supabase.from('categorias').update({ ativo: false }).eq('id', id)
    loadData()
  }

  const abrirModalProduto = (produto?: any) => {
    setEditingProduto(produto || null)
    setShowProdModal(true)
  }

  const deletarProduto = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return
    await supabase.from('produtos').update({ ativo: false }).eq('id', id)
    loadData()
  }

  const temCategorias = categorias.length > 0

  return (
    <div className="space-y-5">
      {/* Header com botões */}
      <div className="glass p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">Organização</div>
          <h2 className="text-lg font-semibold">Produtos</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingCat(null); setNovaCat(''); setShowCatModal(true) }} className="btn-primary">
            <Plus size={14} />Nova sessão
          </button>
          <button
            onClick={() => abrirModalProduto()}
            disabled={!temCategorias}
            className="btn-ghost"
            style={{
              opacity: temCategorias ? 1 : 0.5,
              cursor: temCategorias ? 'pointer' : 'not-allowed',
            }}
            title={!temCategorias ? 'Crie uma sessão antes' : ''}
          >
            <Plus size={14} />Novo produto
          </button>
        </div>
      </div>

      {/* Estado vazio */}
      {!loading && !temCategorias && (
        <div className="glass p-8 text-center">
          <div className="size-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,.14)' }}>
            <UtensilsIcon className="size-8" style={{ color: '#F59E0B' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink)' }}>
            Vamos começar!
          </h3>
          <p className="hint mb-5 max-w-sm mx-auto">
            Para cadastrar seu primeiro produto, crie uma sessão antes.
          </p>
          <button onClick={() => setShowCatModal(true)} className="btn-primary">
            <Plus size={14} />Criar primeira sessão
          </button>
        </div>
      )}

      {/* Lista de sessões */}
      {categorias.map((cat) => (
        <div key={cat.id} className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{cat.nome}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingCat(cat); setNovaCat(cat.nome); setShowCatModal(true) }}
                className="btn-ghost"
              >
                <Edit size={14} />Editar sessão
              </button>
              <button
                onClick={() => deletarCategoria(cat.id)}
                className="btn-ghost text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {produtos[cat.id] && produtos[cat.id].length > 0 ? (
            <div className="space-y-2">
              {produtos[cat.id].map((prod) => (
                <ProdutoLinha
                  key={prod.id}
                  produto={prod}
                  complementosCount={0}
                  onEdit={() => abrirModalProduto(prod)}
                  onToggleAtivo={async () => { await supabase.from('produtos').update({ ativo: !prod.ativo }).eq('id', prod.id); loadData(); }}
                  onDuplicate={async () => { /* no-op */ }}
                  onUpdate={async () => { /* no-op */ }}
                  onDelete={() => deletarProduto(prod.id)}
                />
              ))}
            </div>
          ) : (
            <p className="hint text-center py-4">Nenhum produto nesta sessão</p>
          )}
        </div>
      ))}

      {/* Modal nova/editar sessão — padrão visual de ModalShell + ModalFooter */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
              <h1 className="text-lg font-semibold text-gray-900">{editingCat ? 'Editar Sessão' : 'Criar Nova Sessão'}</h1>
              <button onClick={() => { setShowCatModal(false); setEditingCat(null); setNovaCat('') }} className="text-gray-400 hover:text-gray-700 p-1" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50 space-y-4">
              <h3 className="text-red-600 font-semibold text-sm">Configurações da sessão</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome <span className="text-red-600">*</span>
                </label>
                <input
                  value={novaCat}
                  onChange={(e) => setNovaCat(e.target.value)}
                  placeholder='Ex: "Monte do seu jeito"'
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="text-xs text-gray-500">
                Sugestões: Monte do seu jeito, Combos, Promoções, Bebidas, Sobremesas.
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-white rounded-b-2xl" style={{ borderColor: '#E5E7EB' }}>
              <button onClick={() => { setShowCatModal(false); setEditingCat(null); setNovaCat('') }} className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={editingCat ? atualizarCategoria : criarCategoria}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5"
              >
                <Save size={14} />
                {editingCat ? 'Salvar alterações' : 'Criar sessão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar produto — usa componente dedicado com abas estilo InstaDelivery */}
      {showProdModal && (
        <ProdutoFormModal
          produto={editingProduto}
          categorias={categorias}
          categoriasProduto={categoriasProduto}
          onClose={() => { setShowProdModal(false); setEditingProduto(null) }}
          onSaved={loadData}
        />
      )}
    </div>
  );
}