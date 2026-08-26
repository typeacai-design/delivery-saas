'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import {
  Plus, Edit, Trash2, Search, X, Save, Users,
  Phone, Mail, Calendar, Filter, Download
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Cliente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  endereco: string | null
  bairro: string | null
  cep: string | null
  referencia: string | null
  data_nascimento: string | null
  observacoes: string | null
  tags: string[] | null
  ativo: boolean
  opt_in_whatsapp: boolean
  total_pedidos: number
  ultimo_pedido_em: string | null
  primeiro_pedido_em: string | null
  ltv: number
  created_at: string
  saldo_cashback?: number
  pontos?: number
}

const TAGS_RAPIDAS = [
  { id: 'vip', label: '⭐ VIP', color: '#FEF9C3', fg: '#854D0E' },
  { id: 'novo', label: '✨ Novo', color: '#DBEAFE', fg: '#1E3A8A' },
  { id: 'inativo', label: 'Inativo', color: '#F3F4F6', fg: '#374151' },
  { id: 'aniversariante', label: '🎂 Aniversariante', color: '#FCE7F3', fg: '#9D174D' },
  { id: 'fidelidade', label: '💚 Fidelidade', color: '#DCFCE7', fg: '#166534' },
]

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTag, setFiltroTag] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) { setLoading(false); return }
    const tid = tenantId

    // Buscar clientes e pontos em paralelo
    const [{ data, error }, { data: pontosData }] = await Promise.all([
      supabase
        .from('clientes')
        .select('*')
        .eq('tenant_id', tid)
        .order('ultimo_pedido_em', { ascending: false, nullsFirst: false }),
      supabase
        .from('cliente_pontos')
        .select('cliente_id, pontos_saldo')
        .eq('tenant_id', tid),
    ])

    if (!error && data) {
      // Mapear pontos por cliente_id
      const pontosMap: Record<string, number> = {}
      ;(pontosData || []).forEach((p: any) => {
        pontosMap[p.cliente_id] = p.pontos_saldo
      })
      // Mesclar pontos nos clientes
      const clientesComPontos = (data as any[]).map(c => ({
        ...c,
        pontos: pontosMap[c.id] || 0,
      }))
      setClientes(clientesComPontos)
    }
    setLoading(false)
  }

  const deletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este cliente? Os pedidos existentes serão mantidos.')) return
    await supabase.from('clientes').delete().eq('id', id)
    loadData()
  }

  const abrirModal = (c?: Cliente) => {
    setEditing(c || null)
    setShowModal(true)
  }

  // Métricas resumo
  const totalClientes = clientes.filter(c => c.ativo).length
  const ltvMedio = clientes.filter(c => c.ativo).length > 0
    ? clientes.filter(c => c.ativo).reduce((acc, c) => acc + Number(c.ltv), 0) /
      clientes.filter(c => c.ativo).length
    : 0
  const maisFieis = [...clientes]
    .filter(c => c.ativo)
    .sort((a, b) => (b.total_pedidos || 0) - (a.total_pedidos || 0))
    .slice(0, 3)
  const novosClientes30d = clientes.filter(c => {
    if (!c.created_at) return false
    const dias = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return dias <= 30 && c.ativo
  }).length

  // Filtro
  const filtrados = clientes.filter((c) => {
    if (busca) {
      const b = busca.toLowerCase()
      const match =
        (c.nome || '').toLowerCase().includes(b) ||
        (c.telefone || '').toLowerCase().includes(b) ||
        (c.email || '').toLowerCase().includes(b)
      if (!match) return false
    }
    if (filtroTag) {
      if (!c.tags || !c.tags.includes(filtroTag)) return false
    }
    if (filtroAtivo === 'ativos' && !c.ativo) return false
    if (filtroAtivo === 'inativos' && c.ativo) return false
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-2xl border p-5 mb-4 flex items-center justify-between gap-3" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            <Users size={11} />
            Meus Clientes
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            CRM de Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cadastre, segmente e acompanhe quem compra mais na sua loja.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportarCSV(clientes)}
            className="btn-ghost"
            disabled={clientes.length === 0}
            title="Exportar CSV"
          >
            <Download size={14} />
            Exportar
          </button>
          <button onClick={() => abrirModal()} className="btn-primary">
            <Plus size={14} />
            Novo cliente
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Total de clientes" value={totalClientes} icon={Users} color="#16A34A" />
        <MetricCard label="LTV médio" value={formatCurrency(ltvMedio)} icon={Star} color="#EAB308" />
        <MetricCard label="Novos (30d)" value={novosClientes30d} icon={Plus} color="#3B82F6" />
        <MetricCard
          label="Top 3 mais fiéis"
          value=""
          icon={Trophy}
          color="#A855F7"
          topList={maisFieis}
        />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border p-4 mb-4 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB' }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, telefone ou email"
            className="form-input pl-9"
          />
        </div>
        <select
          value={filtroTag}
          onChange={(e) => setFiltroTag(e.target.value)}
          className="form-input flex-1 min-w-[180px]"
        >
          <option value="">Todas as tags</option>
          {TAGS_RAPIDAS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <select
          value={filtroAtivo}
          onChange={(e) => setFiltroAtivo(e.target.value)}
          className="form-input flex-1 min-w-[180px]"
        >
          <option value="todos">Ativos e inativos</option>
          <option value="ativos">Apenas ativos</option>
          <option value="inativos">Apenas inativos</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Carregando clientes...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {clientes.length === 0
              ? 'Nenhum cliente cadastrado ainda. Clique em "Novo cliente" pra começar.'
              : 'Nenhum cliente encontrado com esses filtros.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Tags</th>
                <th className="text-right px-4 py-3">Pedidos</th>
                <th className="text-right px-4 py-3">LTV</th>
                <th className="text-right px-4 py-3">Pontos</th>
                <th className="text-left px-4 py-3">Último pedido</th>
                <th className="text-left px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const tagsCliente = (c.tags || []).map(id =>
                  TAGS_RAPIDAS.find(t => t.id === id)
                ).filter(Boolean) as any[]
                return (
                  <tr key={c.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.nome}</div>
                      {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                      {c.data_nascimento && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          {formatarDataNasc(c.data_nascimento)}
                        </div>
                      )}
                      {!c.ativo && (
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <a
                        href={`https://wa.me/55${(c.telefone || '').replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-green-600 flex items-center gap-1"
                      >
                        <Phone size={11} />
                        {c.telefone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tagsCliente.length === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          tagsCliente.map((t) => (
                            <span
                              key={t.id}
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: t.color, color: t.fg }}
                            >
                              {t.label}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-gray-900">{c.total_pedidos || 0}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-green-700">
                        {formatCurrency(Number(c.ltv) || 0)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-yellow-600">
                        ⭐ {c.pontos || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.ultimo_pedido_em
                        ? tempoRelativo(c.ultimo_pedido_em)
                        : <span className="text-gray-400">Nunca pediu</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirModal(c)}
                          className="size-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600"
                          title="Editar"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => deletar(c.id)}
                          className="size-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600"
                          title="Apagar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ClienteModal
          cliente={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={loadData}
        />
      )}
    </div>
  )
}

/* ===========================================================
   COMPONENTES AUXILIARES
   =========================================================== */
function MetricCard({ label, value, icon: Icon, color, topList }: any) {
  return (
    <div className="bg-white rounded-2xl border p-4" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
      {topList ? (
        <div className="space-y-1">
          {topList.length === 0 ? (
            <div className="text-xs text-gray-400">—</div>
          ) : topList.map((c: any, i: number) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate">
                {i + 1}. {c.nome}
              </span>
              <span className="text-gray-500 text-xs">{c.total_pedidos}×</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      )}
    </div>
  )
}

function Star({ size, style }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function Trophy({ size, style }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function ClienteModal({ cliente, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    telefone: cliente?.telefone || '',
    email: cliente?.email || '',
    cep: cliente?.cep || '',
    endereco: cliente?.endereco || '',
    bairro: cliente?.bairro || '',
    referencia: cliente?.referencia || '',
    data_nascimento: cliente?.data_nascimento || '',
    observacoes: cliente?.observacoes || '',
    tags: (cliente?.tags || []) as string[],
    ativo: cliente?.ativo ?? true,
    opt_in_whatsapp: cliente?.opt_in_whatsapp ?? true,
  })
  const [salvando, setSalvando] = useState(false)
  const supabase = createClient()

  const toggleTag = (id: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(id) ? f.tags.filter((t: string) => t !== id) : [...f.tags, id],
    }))
  }

  const submit = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) return
    setSalvando(true)
    const tenantId = await activeTenantId()
    if (!tenantId) { setSalvando(false); return }

    const telefoneLimpo = form.telefone.replace(/\D/g, '')

    const payload: any = {
      nome: form.nome,
      telefone: telefoneLimpo,
      email: form.email || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      referencia: form.referencia || null,
      data_nascimento: form.data_nascimento || null,
      observacoes: form.observacoes || null,
      tags: form.tags,
      ativo: form.ativo,
      opt_in_whatsapp: form.opt_in_whatsapp,
    }

    if (cliente) {
      await supabase.from('clientes').update(payload).eq('id', cliente.id)
    } else {
      // upsert pra evitar duplicar telefone
      const { data: existing } = await supabase
        .from('clientes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('telefone', telefoneLimpo)
        .maybeSingle()
      if (existing) {
        await supabase.from('clientes').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('clientes').insert({
          ...payload,
          tenant_id: tenantId,
        })
      }
    }

    setSalvando(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="text-lg font-semibold text-gray-900">
            {cliente ? 'Editar cliente' : 'Novo cliente'}
          </h1>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50 space-y-4">
          <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-semibold text-gray-900">Identificação</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome" required>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="form-input"
                  autoFocus
                />
              </Field>
              <Field label="Telefone / WhatsApp" required>
                <input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(47) 99999-9999"
                  className="form-input"
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="form-input"
                />
              </Field>
              <Field label="Data de nascimento">
                <input
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                  className="form-input"
                />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-semibold text-gray-900">Endereço de entrega</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="CEP">
                <input
                  value={form.cep}
                  onChange={(e) => setForm({ ...form, cep: e.target.value })}
                  placeholder="89000-000"
                  className="form-input"
                />
              </Field>
              <Field label="Bairro" className="md:col-span-2">
                <input
                  value={form.bairro}
                  onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  placeholder="Ex: Centro"
                  className="form-input"
                />
              </Field>
              <Field label="Endereço" className="md:col-span-3">
                <input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Rua, número"
                  className="form-input"
                />
              </Field>
              <Field label="Referência" className="md:col-span-3">
                <input
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Ex: Próximo ao mercado"
                  className="form-input"
                />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-sm font-semibold text-gray-900">Tags e observações</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {TAGS_RAPIDAS.map((t) => {
                  const ativo = form.tags.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                      style={
                        ativo
                          ? { background: t.color, color: t.fg, border: `1.5px solid ${t.fg}` }
                          : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                      }
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Field label="Observações internas" hint="(só o lojista vê)">
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Ex: Cliente VIP, prefere entrega após 19h"
                rows={3}
                className="form-input"
              />
            </Field>

            <div className="space-y-2 pt-2 border-t" style={{ borderColor: '#F3F4F6' }}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="size-4 rounded border-gray-300 text-green-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Cliente ativo</div>
                  <div className="text-xs text-gray-500">Recebe campanhas de marketing</div>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.opt_in_whatsapp}
                  onChange={(e) => setForm({ ...form, opt_in_whatsapp: e.target.checked })}
                  className="size-4 rounded border-gray-300 text-green-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Aceita receber WhatsApp</div>
                  <div className="text-xs text-gray-500">Autorizou mensagens da loja</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-white" style={{ borderColor: '#E5E7EB' }}>
          <button onClick={onClose} className="btn-ghost" disabled={salvando}>Cancelar</button>
          <button
            onClick={submit}
            className="btn-primary"
            disabled={salvando || !form.nome.trim() || !form.telefone.trim()}
          >
            <Save size={14} />
            {salvando ? 'Salvando...' : cliente ? 'Salvar' : 'Criar cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, hint, children, className }: any) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="text-gray-400 font-normal ml-1">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function formatarDataNasc(d: string) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 7) return `${dias}d atrás`
  if (dias < 30) return `${Math.floor(dias / 7)}sem atrás`
  if (dias < 365) return `${Math.floor(dias / 30)}m atrás`
  return `${Math.floor(dias / 365)}a atrás`
}

function exportarCSV(clientes: Cliente[]) {
  const header = ['Nome', 'Telefone', 'Email', 'Data Nascimento', 'Endereço', 'Bairro', 'Tags', 'Ativo', 'Total Pedidos', 'LTV', 'Pontos', 'Último pedido']
  const linhas = clientes.map((c) => [
    c.nome,
    c.telefone,
    c.email || '',
    c.data_nascimento || '',
    c.endereco || '',
    c.bairro || '',
    (c.tags || []).join('|'),
    c.ativo ? 'sim' : 'não',
    c.total_pedidos || 0,
    c.ltv || 0,
    c.pontos || 0,
    c.ultimo_pedido_em || '',
  ])
  const csv = [header, ...linhas].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

