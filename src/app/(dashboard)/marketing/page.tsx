'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Cake, Trophy, Users, Tag, RefreshCw, Sparkles, Plus, Calendar, Search, Edit, Trash2, Star, Send, Clock
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import FidelidadeTab from '@/components/admin/marketing/FidelidadeTab'
import DisparoTab from '@/components/admin/marketing/DisparoTab'
import CarrinhoAbandonadoTab from '@/components/admin/marketing/CarrinhoAbandonadoTab'
import MeusClientesTab from '@/components/admin/marketing/MeusClientesTab'
import AvaliacoesPage from '../avaliacoes/page'

type Tab = 'clientes' | 'fidelidade' | 'disparo' | 'carrinho' | 'aniversariantes' | 'top' | 'cupons' | 'avaliacoes'
type Periodo = '7d' | '15d' | '30d' | 'custom'

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('aniversariantes')
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<any[]>([])
  const [topClientes, setTopClientes] = useState<any[]>([])
  const [cupons, setCupons] = useState<any[]>([])
  const [clientesRecuperacao, setClientesRecuperacao] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' })
    const session = await sessionResponse.json()
    if (!sessionResponse.ok || !session.tenant?.id) { setLoading(false); return }
    const tid = session.tenant.id

    // Clientes
    const { data: cls } = await supabase
      .from('clientes')
      .select('*, pedidos(id, valor_total, data_criacao)')
      .eq('tenant_id', tid)
      .order('nome')
    setClientes(cls || [])

    // Top
    const grupos: Record<string, any> = {}
    cls?.forEach((c: any) => {
      grupos[c.id] = { id: c.id, nome: c.nome, telefone: c.telefone, total: 0, count: 0, ultimo: null }
      c.pedidos?.forEach((p: any) => {
        grupos[c.id].total += Number(p.valor_total)
        grupos[c.id].count += 1
        if (!grupos[c.id].ultimo || new Date(p.data_criacao) > new Date(grupos[c.id].ultimo)) {
          grupos[c.id].ultimo = p.data_criacao
        }
      })
    })
    setTopClientes(Object.values(grupos).sort((a, b) => b.count - a.count).slice(0, 20))

    // Recuperação: clientes cujo último pedido > 30 dias
    const agora = new Date()
    const recuperacao = cls?.filter((c: any) => {
      if (!c.pedidos || c.pedidos.length === 0) return true
      const ultimo = c.pedidos.reduce((max: string, p: any) =>
        !max || new Date(p.data_criacao) > new Date(max) ? p.data_criacao : max, '')
      const dias = Math.ceil((agora.getTime() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24))
      return dias >= 7
    }).map((c: any) => {
      const ultimo = c.pedidos?.reduce((max: string, p: any) =>
        !max || new Date(p.data_criacao) > new Date(max) ? p.data_criacao : max, '')
      const dias = ultimo ? Math.ceil((agora.getTime() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24)) : null
      return { ...c, diasSemPedido: dias }
    }).sort((a, b) => (b.diasSemPedido || 999) - (a.diasSemPedido || 999)) || []
    setClientesRecuperacao(recuperacao)

    // Cupons do banco
    const { data: cps } = await supabase
      .from('cupons')
      .select('*')
      .eq('tenant_id', tid)
      .order('created_at', { ascending: false })
    setCupons(cps || [])

    setLoading(false)
  }

  const tabs = [
    { id: 'clientes', label: 'Meus Clientes', icon: Users },
    { id: 'fidelidade', label: 'Fidelidade', icon: Star },
    { id: 'disparo', label: 'Disparo WhatsApp', icon: Send },
    { id: 'carrinho', label: 'Carrinho abandonado', icon: Clock },
    { id: 'aniversariantes', label: 'Aniversariantes', icon: Cake },
    { id: 'top', label: 'Top clientes', icon: Trophy },
    { id: 'cupons', label: 'Cupons', icon: Tag },
    { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  ] as const

  return (
    <div>
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Sparkles size={11} />
            Marketing
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
            Marketing
          </h1>
          <p className="hint mt-2">Clientes, fidelização e recuperação</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        {tabs.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex min-h-20 flex-col items-start justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition text-left"
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

      {loading ? (
        <div className="text-center py-8 hint">Carregando...</div>
      ) : (
        <>
          {tab === 'clientes' && <MeusClientesTab />}
          {tab === 'fidelidade' && <FidelidadeTab />}
          {tab === 'disparo' && <DisparoTab clientes={clientes} />}
          {tab === 'carrinho' && <CarrinhoAbandonadoTab />}
          {tab === 'aniversariantes' && <AniversariantesTab clientes={clientes} />}
          {tab === 'top' && <TopTab topClientes={topClientes} />}
          {tab === 'cupons' && <CuponsTab cupons={cupons} />}
          {tab === 'avaliacoes' && <AvaliacoesPage />}
        </>
      )}
    </div>
  )
}

function AniversariantesTab({ clientes }: { clientes: any[] }) {
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'custom'>('semana')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const getAniversariantes = () => {
    const hoje = new Date()
    let fim: Date
    if (periodo === 'semana') {
      fim = new Date(); fim.setDate(fim.getDate() + 7)
    } else if (periodo === 'mes') {
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    } else {
      if (!dataInicio || !dataFim) return []
      const inicio = new Date(dataInicio)
      fim = new Date(dataFim)
      return clientes.filter((c) => {
        if (!c.data_nascimento) return false
        const nasc = new Date(c.data_nascimento)
        const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())
        return aniv >= inicio && aniv <= fim
      })
    }
    return clientes.filter((c) => {
      if (!c.data_nascimento) return false
      const nasc = new Date(c.data_nascimento)
      const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())
      return aniv >= hoje && aniv <= fim
    }).sort((a, b) => new Date(a.data_nascimento).getDate() - new Date(b.data_nascimento).getDate())
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const list = getAniversariantes()

  return (
    <div className="glass p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <div className="eyebrow mb-1">Período</div>
          <h2 className="text-lg font-semibold">Aniversariantes</h2>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {(['semana', 'mes', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={
                periodo === p
                  ? { background: 'var(--green)', color: 'white' }
                  : { background: 'rgba(255,255,255,.7)', color: 'var(--ink-muted)', border: '1px solid var(--line)' }
              }
            >
              {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mês' : 'Personalizado'}
            </button>
          ))}
          {periodo === 'custom' && (
            <div className="flex gap-1 items-center">
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: 8 }} />
              <span className="hint">até</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: 8 }} />
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.id} className="glass-soft p-4 flex items-center gap-4">
            <div className="size-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)' }}>
              <Cake size={18} style={{ color: '#15803D' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{c.nome}</div>
              <div className="hint text-xs">{c.telefone}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold" style={{ color: '#15803D' }}>🎂 {formatDate(c.data_nascimento)}</div>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-center py-12">
            <div className="size-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.12)' }}>
              <Cake size={24} style={{ color: '#15803D' }} />
            </div>
            <div className="text-sm font-medium">Nenhum aniversariante no período</div>
            <div className="hint mt-1">Cadastre a data de nascimento dos clientes</div>
          </div>
        )}
      </div>
    </div>
  )
}

function TopTab({ topClientes }: { topClientes: any[] }) {
  return (
    <div className="glass p-6">
      <div className="eyebrow mb-1">Ranking</div>
      <h2 className="text-lg font-semibold mb-5">Top clientes</h2>
      <div className="space-y-2">
        {topClientes.map((c, i) => (
          <div key={c.id} className="glass-soft p-4 flex items-center gap-4">
            <div
              className="size-11 rounded-2xl flex items-center justify-center font-bold text-sm"
              style={
                i === 0 ? { background: 'linear-gradient(135deg, #16A34A, #22C55E)', color: 'white' }
                : i === 1 ? { background: 'linear-gradient(135deg, #4ADE80, #86EFAC)', color: 'white' }
                : i === 2 ? { background: 'linear-gradient(135deg, #BBF7D0, #86EFAC)', color: '#15803D' }
                : { background: 'rgba(22,163,74,.10)', color: 'var(--ink)' }
              }
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{c.nome}</div>
              <div className="hint text-xs">{c.telefone}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold gradient-text">{c.count} pedido{c.count !== 1 && 's'}</div>
              <div className="hint text-xs">{formatCurrency(c.total)}</div>
            </div>
          </div>
        ))}
        {topClientes.length === 0 && (
          <div className="text-center py-12 hint">Sem pedidos ainda</div>
        )}
      </div>
    </div>
  )
}

function ClientesTab({ clientes }: { clientes: any[] }) {
  return (
    <div className="glass p-6">
      <div className="eyebrow mb-1">Base</div>
      <h2 className="text-lg font-semibold mb-5">{clientes.length} cliente{clientes.length !== 1 && 's'} cadastrado{clientes.length !== 1 && 's'}</h2>
      <div className="space-y-2">
        {clientes.map((c) => {
          const total = c.pedidos?.length || 0
          return (
            <div key={c.id} className="glass-soft p-4 flex items-center gap-4">
              <div className="size-10 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{ background: 'var(--green)' }}>
                {c.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{c.nome}</div>
                <div className="hint text-xs">{c.telefone} {c.bairro && `• ${c.bairro}`}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold">{total}</div>
                <div className="hint text-xs">pedidos</div>
              </div>
            </div>
          )
        })}
        {clientes.length === 0 && (
          <div className="text-center py-12 hint">Nenhum cliente ainda</div>
        )}
      </div>
    </div>
  )
}

function CuponsTab({ cupons: initialCupons }: { cupons: any[] }) {
  const [cupons, setCupons] = useState(initialCupons)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    codigo: '', tipo: 'percentual', valor: '', valor_minimo_pedido: '',
    validade: '', max_usos: '',
  })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const abrirNovo = () => {
    setEditing(null)
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 30)
    setForm({ codigo: '', tipo: 'percentual', valor: '', valor_minimo_pedido: '0', validade: amanha.toISOString().split('T')[0], max_usos: '' })
    setShowModal(true)
  }

  const abrirEditar = (c: any) => {
    setEditing(c)
    setForm({
      codigo: c.codigo, tipo: c.tipo, valor: String(c.valor),
      valor_minimo_pedido: String(c.valor_minimo_pedido || 0),
      validade: c.validade?.split('T')[0] || '',
      max_usos: c.max_usos ? String(c.max_usos) : '',
    })
    setShowModal(true)
  }

  const salvar = async () => {
    if (!form.codigo.trim() || !form.valor || !form.validade) return
    setSaving(true)
    const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' })
    const session = await sessionResponse.json()
    const tenantId = session.tenant?.id
    if (!sessionResponse.ok || !tenantId) { setSaving(false); return }

    const dados = {
      codigo: form.codigo.toUpperCase(),
      tipo: form.tipo,
      valor: parseFloat(form.valor),
      valor_minimo_pedido: parseFloat(form.valor_minimo_pedido) || 0,
      validade: form.validade,
      max_usos: form.max_usos ? parseInt(form.max_usos) : null,
      ativo: true,
    }

    if (editing) {
      await supabase.from('cupons').update(dados).eq('id', editing.id).eq('tenant_id', tenantId)
    } else {
      await supabase.from('cupons').insert({ tenant_id: tenantId, ...dados })
    }

    // Reload
    const { data: cps } = await supabase.from('cupons').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setCupons(cps || [])
    setShowModal(false)
    setSaving(false)
  }

  const deletar = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return
    await supabase.from('cupons').update({ ativo: false }).eq('id', id)
    setCupons(cupons.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="glass p-6">
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="eyebrow mb-1">Promoções</div>
            <h2 className="text-lg font-semibold">Cupons de desconto</h2>
          </div>
          <button onClick={abrirNovo} className="btn-primary">
            <Plus size={14} />Novo cupom
          </button>
        </div>
        <div className="space-y-2">
          {cupons.map((c) => (
            <div key={c.id} className="glass-soft p-4 flex items-center gap-4">
              <div className="size-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.14)' }}>
                <Tag size={18} style={{ color: '#15803D' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold tracking-wider">{c.codigo}</span>
                  <span className="chip chip--positive">{c.tipo === 'percentual' ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2)}`}</span>
                  {!c.ativo && <span className="chip chip--negative">Inativo</span>}
                </div>
                <div className="hint text-xs">Válido até {new Date(c.validade).toLocaleDateString('pt-BR')} • mín. {formatCurrency(Number(c.valor_minimo_pedido) || 0)}</div>
              </div>
              <div className="text-right mr-2">
                <div className="text-sm font-semibold">{c.usos_atuais || 0}{c.max_usos ? `/${c.max_usos}` : ''}</div>
                <div className="hint text-xs">usos</div>
              </div>
              <button className="btn-icon-round" onClick={() => abrirEditar(c)} style={{ width: 32, height: 32, background: 'rgba(22,163,74,.14)', border: 'none' }}>
                <Edit size={14} style={{ color: '#15803D' }} />
              </button>
              <button className="btn-icon-round" onClick={() => deletar(c.id)} style={{ width: 32, height: 32, background: 'rgba(220,38,38,.10)', border: 'none' }}>
                <Trash2 size={14} style={{ color: '#B91C1C' }} />
              </button>
            </div>
          ))}
          {cupons.length === 0 && (
            <div className="text-center py-12">
              <div className="size-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.12)' }}>
                <Tag size={24} style={{ color: '#15803D' }} />
              </div>
              <div className="text-sm font-medium">Nenhum cupom criado</div>
              <div className="hint mt-1">Crie cupons para oferecer descontos aos clientes</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-1">{editing ? 'Editar cupom' : 'Novo cupom'}</h2>
            <p className="hint text-xs mb-4">Cupons funcionam no checkout via WhatsApp</p>
            <div className="space-y-3">
              <div>
                <label>Código do cupom</label>
                <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex: BEMVINDO10" autoFocus className="font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="percentual">Percentual (%)</option>
                    <option value="valor_fixo">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label>Valor</label>
                  <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Ex: 10" />
                </div>
              </div>
              <div>
                <label>Validade</label>
                <input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>Valor mín. pedido (R$)</label>
                  <input type="number" step="0.01" value={form.valor_minimo_pedido} onChange={(e) => setForm({ ...form, valor_minimo_pedido: e.target.value })} placeholder="0 = sem mínimo" />
                </div>
                <div>
                  <label>Máx. usos (0 = ilimitado)</label>
                  <input type="number" value={form.max_usos} onChange={(e) => setForm({ ...form, max_usos: e.target.value })} placeholder="Ilimitado" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center" disabled={saving}>Cancelar</button>
              <button onClick={salvar} className="btn-primary flex-1 justify-center" disabled={saving || !form.codigo || !form.valor || !form.validade}>
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar cupom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RecuperacaoTab({ clientes }: { clientes: any[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const dias = periodo === '7d' ? 7 : periodo === '15d' ? 15 : periodo === '30d' ? 30 : null
  const filtrados = clientes.filter((c) => {
    if (dias === null) {
      // custom
      if (!dataInicio || !dataFim || !c.ultimo) return true
      const inicio = new Date(dataInicio)
      const fim = new Date(dataFim)
      const ult = new Date(c.ultimo)
      return ult >= inicio && ult <= fim
    }
    if (!c.ultimo) return true
    return c.diasSemPedido >= dias
  })

  return (
    <div className="glass p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <div className="eyebrow mb-1">Recuperar</div>
          <h2 className="text-lg font-semibold">Clientes inativos</h2>
          <p className="hint text-xs mt-1">Clientes que não pedem há um tempo</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {(['7d', '15d', '30d', 'custom'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={
                periodo === p
                  ? { background: 'var(--green)', color: 'white' }
                  : { background: 'rgba(255,255,255,.7)', color: 'var(--ink-muted)', border: '1px solid var(--line)' }
              }
            >
              {p === '7d' ? '7 dias' : p === '15d' ? '15 dias' : p === '30d' ? '30 dias' : 'Personalizado'}
            </button>
          ))}
          {periodo === 'custom' && (
            <div className="flex gap-1 items-center">
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: 8 }} />
              <span className="hint">a</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: 8 }} />
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {filtrados.map((c) => (
          <div key={c.id} className="glass-soft p-4 flex items-center gap-4">
            <div className="size-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.12)' }}>
              <RefreshCw size={18} style={{ color: '#15803D' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{c.nome}</div>
              <div className="hint text-xs">{c.telefone}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold" style={{ color: '#15803D' }}>
                {c.ultimo ? `${c.diasSemPedido} dias` : 'Nunca pediu'}
              </div>
              <div className="hint text-xs">{c.ultimo ? `último: ${new Date(c.ultimo).toLocaleDateString('pt-BR')}` : 'novo cliente'}</div>
            </div>
            <button className="btn-ghost text-xs" style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}>
              Mandar cupom
            </button>
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="text-center py-12">
            <div className="hint">Nenhum cliente inativo no período</div>
          </div>
        )}
      </div>
    </div>
  )
}
