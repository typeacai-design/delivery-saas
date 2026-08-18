'use client'

import { useState, useEffect } from 'react'
import { Store, Search, Plus, AlertTriangle, Mail, Key, Eye, Ban, CheckCircle, Trash2, Save, X } from 'lucide-react'
import { InputField, SelectField, SearchableSelect } from '@/components/form-field'
import { ESTADOS } from '@/lib/cidades-brasil'
import { adminFetch } from '@/lib/admin-fetch'

const CATEGORIAS = [
  'Açaiteria', 'Pizzaria', 'Hamburgueria', 'Lanchonete', 'Restaurante',
  'Marmitaria', 'Padaria', 'Cafeteria', 'Doceria', 'Sorveteria',
  'Pastelaria', 'Bar ou petiscaria', 'Comida japonesa', 'Comida saudável', 'Outros'
]

const ESTADOS_LIST = ESTADOS.map((e) => e.uf)

function formatPhone(v: string) {
  const c = (v || '').replace(/\D/g, '').slice(0, 11)
  return c.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

function formatCpf(v: string) {
  const c = (v || '').replace(/\D/g, '').slice(0, 11)
  return c
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    .replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/(\d{3})(\d{3})/, '$1.$2')
    .trim()
}

export default function LojistasPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'pendentes' | 'inadimplentes'>('todos')
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [showNovoModal, setShowNovoModal] = useState(false)

  useEffect(() => {
    fetchTenants()
    // Se vier ?novo=1, abre modal de novo lojista
    const params = new URLSearchParams(window.location.search)
    if (params.get('novo') === '1') {
      setShowNovoModal(true)
      // limpa a query pra não reabrir em refresh
      window.history.replaceState({}, '', '/painel-admin/lojistas')
    }
  }, [])

  const fetchTenants = async () => {
    try {
      const res = await adminFetch('/api/admin/tenants')
      const data = await res.json()
      setTenants(data.tenants || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTenants = tenants.filter(t => {
    const matchSearch = !search || (
      t.nome?.toLowerCase().includes(search.toLowerCase()) ||
      t.slug?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase())
    )

    if (filtro === 'ativos') return matchSearch && t.status === 'active'
    if (filtro === 'pendentes') return matchSearch && t.status === 'pending_approval'
    if (filtro === 'inadimplentes') return matchSearch && t.status_pagamento !== 'pago'
    return matchSearch
  })

  const atualizarStatus = async (id: string, updates: any) => {
    try {
      await adminFetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      fetchTenants()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const handleAprovar = async (tenant: any) => {
    if (!confirm(`Aprovar o cadastro de "${tenant.nome}"?\n\nEle(a) poderá fazer login imediatamente após a aprovação.`)) return
    await atualizarStatus(tenant.id, { status: 'active' })
    alert('Lojista aprovado com sucesso!')
  }

  const handleSuspender = async (tenant: any) => {
    if (!confirm(`Suspender "${tenant.nome}"?\n\nEle(a) não conseguirá mais acessar o painel até ser reativado.`)) return
    await atualizarStatus(tenant.id, { status: 'suspended' })
  }

  const handleReativar = async (tenant: any) => {
    if (!confirm(`Reativar "${tenant.nome}"?`)) return
    await atualizarStatus(tenant.id, { status: 'active' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Gestão</div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>Lojistas</h1>
          <p className="hint mt-1">
            {tenants.length} lojistas · {tenants.filter(t => t.status === 'pending_approval').length} aguardando aprovação
          </p>
        </div>
        <button onClick={() => setShowNovoModal(true)} className="btn-primary">
          <Plus size={14} />
          Novo Lojista
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome, slug ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFiltro('todos')} className={`btn-ghost ${filtro === 'todos' ? '' : 'opacity-60'}`}>
            Todos ({tenants.length})
          </button>
          <button onClick={() => setFiltro('pendentes')} className={`btn-ghost ${filtro === 'pendentes' ? '' : 'opacity-60'}`}>
            <ClockIcon /> Pendentes ({tenants.filter(t => t.status === 'pending_approval').length})
          </button>
          <button onClick={() => setFiltro('ativos')} className={`btn-ghost ${filtro === 'ativos' ? '' : 'opacity-60'}`}>
            Ativos ({tenants.filter(t => t.status === 'active').length})
          </button>
          <button onClick={() => setFiltro('inadimplentes')} className={`btn-ghost ${filtro === 'inadimplentes' ? '' : 'opacity-60'}`}>
            <AlertTriangle size={14} />
            Inadimplentes ({tenants.filter(t => t.status_pagamento !== 'pago').length})
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="glass-soft p-12 text-center rounded-2xl">
          <p className="hint">Carregando...</p>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="glass-soft p-12 text-center rounded-2xl">
          <Store className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--ink-muted)' }} />
          <p className="hint font-medium">Nenhum lojista encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTenants.map((tenant) => {
            const statusBadge = getStatusBadge(tenant)
            return (
              <div
                key={tenant.id}
                className="glass-soft p-4 rounded-2xl hover:bg-black/[0.02] transition-all cursor-pointer"
                onClick={() => { setSelectedTenant(tenant); setShowModal(true) }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="size-12 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: 'var(--green)' }}>
                      {tenant.nome?.[0]?.toUpperCase() || 'L'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{tenant.nome}</p>
                      <p className="hint text-sm truncate">
                        @{tenant.slug} · {tenant.cidade || 'Sem cidade'} · {tenant.email || 'sem email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`chip ${statusBadge.className}`}>{statusBadge.label}</span>
                    {tenant.status === 'pending_approval' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAprovar(tenant) }}
                        className="btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        <CheckCircle size={14} />
                        Aprovar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Edição */}
      {showModal && selectedTenant && (
        <ModalDetalhes
          tenant={selectedTenant}
          onClose={() => { setShowModal(false); setSelectedTenant(null) }}
          onSave={async (updates: any) => {
            await atualizarStatus(selectedTenant.id, updates)
            setShowModal(false)
            setSelectedTenant(null)
          }}
          onAprovar={() => handleAprovar(selectedTenant)}
          onSuspender={() => handleSuspender(selectedTenant)}
          onReativar={() => handleReativar(selectedTenant)}
          onDeletar={async () => {
            if (!confirm(`Tem certeza que deseja DELETAR "${selectedTenant.nome}"?\n\nEssa ação não pode ser desfeita.`)) return
            const response = await adminFetch(`/api/admin/tenants?id=${selectedTenant.id}`, { method: 'DELETE' })
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}))
              alert(payload.error || 'Não foi possível excluir o lojista.')
              return
            }
            setShowModal(false)
            setSelectedTenant(null)
            fetchTenants()
          }}
        />
      )}

      {/* Modal de Novo Lojista */}
      {showNovoModal && (
        <ModalNovoLojista
          onClose={() => setShowNovoModal(false)}
          onSuccess={() => {
            setShowNovoModal(false)
            fetchTenants()
          }}
        />
      )}
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  )
}

function getStatusBadge(t: any) {
  if (t.status === 'pending_approval') return { label: 'Aguardando aprovação', className: 'chip--warn' }
  if (t.status === 'suspended') return { label: 'Suspenso', className: 'chip--negative' }
  // active
  if (t.status_pagamento === 'pago') return { label: 'Ativo · Em dia', className: 'chip--positive' }
  return { label: 'Ativo · Pendente', className: 'chip--negative' }
}

/* ================================================
   MODAL: DETALHES + EDIÇÃO DO LOJISTA
   ================================================ */
function ModalDetalhes({ tenant, onClose, onSave, onAprovar, onSuspender, onReativar, onDeletar }: any) {
  const [editing, setEditing] = useState(tenant.status === 'pending_approval') // entra editável se pendente
  const [saving, setSaving] = useState(false)
  const [cidades, setCidades] = useState<string[]>([])
  const [form, setForm] = useState({
    nome: tenant.nome || '',
    slug: tenant.slug || '',
    email: tenant.email || '',
    senha: '',
    categoria: tenant.categoria || 'Outros',
    telefone: tenant.telefone || '',
    estado: tenant.estado || '',
    cidade: tenant.cidade || '',
    endereco: tenant.endereco || '',
    numero: tenant.numero || '',
    complemento: tenant.complemento || '',
    nome_responsavel: tenant.nome_responsavel || '',
    cpf: tenant.cpf || '',
    valor_mensalidade: tenant.valor_mensalidade?.toString() || '99.90',
    status: tenant.status || 'pending_approval',
    status_pagamento: tenant.status_pagamento || 'pendente',
  })

  // Carregar cidades do estado quando editar
  useEffect(() => {
    if (!editing || !form.estado) {
      setCidades([])
      return
    }
    let cancelled = false
    import('@/lib/cidades-brasil').then(mod => {
      mod.getCidadesByEstado(form.estado).then((lista) => {
        if (!cancelled) setCidades(lista)
      })
    })
    return () => { cancelled = true }
  }, [form.estado, editing])

  const handleSave = async () => {
    setSaving(true)
    const updates: any = {
      nome: form.nome,
      slug: form.slug,
      email: form.email,
      categoria: form.categoria,
      telefone: form.telefone,
      estado: form.estado,
      cidade: form.cidade,
      endereco: form.endereco,
      nome_responsavel: form.nome_responsavel,
      cpf: form.cpf,
      valor_mensalidade: Number(form.valor_mensalidade) || 99.90,
      status: form.status,
      status_pagamento: form.status_pagamento,
    }
    if (form.senha) updates.password = form.senha

    await onSave(updates)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass p-6 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {editing ? 'Editar Lojista' : 'Detalhes do Lojista'}
            </h2>
            {tenant.status === 'pending_approval' && !editing && (
              <p className="hint text-xs mt-1">⚠️ Aguardando sua aprovação</p>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={16} />
          </button>
        </div>

        {/* Aviso se cadastro incompleto */}
        {!editing && (!tenant.email || !tenant.cidade || !tenant.telefone) && (
          <div
            className="mb-5 p-4 rounded-2xl flex items-center justify-between gap-3"
            style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)' }}
          >
            <div>
              <p className="font-semibold text-sm" style={{ color: '#991B1B' }}>
                ⚠️ Cadastro incompleto
              </p>
              <p className="hint text-xs mt-0.5" style={{ color: '#991B1B' }}>
                Clique em "Editar dados" para preencher email, telefone e endereço.
              </p>
            </div>
          </div>
        )}

        {/* Botão Aprovar em destaque se pendente */}
        {tenant.status === 'pending_approval' && (
          <div
            className="mb-5 p-4 rounded-2xl flex items-center justify-between gap-3"
            style={{ background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.30)' }}
          >
            <div>
              <p className="font-semibold text-sm" style={{ color: '#92400E' }}>
                🕐 Cadastro aguardando aprovação
              </p>
              <p className="hint text-xs mt-0.5">
                Aprove para liberar o acesso imediato ao lojista.
              </p>
            </div>
            <button onClick={onAprovar} className="btn-primary flex-shrink-0">
              <CheckCircle size={14} />
              Aprovar agora
            </button>
          </div>
        )}

        {!editing ? (
          // Modo visualização
          <div className="space-y-4">
            <div className="text-center mb-4">
              <div
                className="size-16 rounded-2xl mx-auto mb-3 flex items-center justify-center font-bold text-2xl text-white"
                style={{ background: 'var(--green)' }}
              >
                {tenant.nome?.[0]?.toUpperCase() || 'L'}
              </div>
              <h3 className="font-semibold text-lg">{tenant.nome}</h3>
              <p className="hint">@{tenant.slug}</p>
              <span className={`chip mt-2 ${getStatusBadge(tenant).className}`}>
                {getStatusBadge(tenant).label}
              </span>
            </div>

            <div className="space-y-2">
              <InfoRow label="Email" value={tenant.email || 'Não cadastrado'} />
              <InfoRow label="Categoria" value={tenant.categoria || '—'} />
              <InfoRow label="Telefone" value={tenant.telefone || '—'} />
              <InfoRow label="Localização" value={`${tenant.cidade || '—'}${tenant.estado ? ` / ${tenant.estado}` : ''}`} />
              <InfoRow label="Endereço" value={tenant.endereco || '—'} />
              <InfoRow label="Responsável" value={tenant.nome_responsavel || '—'} />
              <InfoRow label="CPF" value={tenant.cpf || '—'} />
              <InfoRow label="Mensalidade" value={`R$ ${(Number(tenant.valor_mensalidade) || 99.90).toFixed(2)}`} />
              <InfoRow label="Criado em" value={new Date(tenant.created_at).toLocaleString('pt-BR')} />
            </div>

            <div className="border-t pt-4 mt-4 flex flex-wrap gap-2" style={{ borderColor: 'var(--line)' }}>
              <button onClick={() => setEditing(true)} className="btn-primary flex-1">
                <Save size={14} />
                Editar dados
              </button>
              {tenant.status === 'active' && (
                <button onClick={onSuspender} className="btn-ghost">
                  <Ban size={14} />
                  Suspender
                </button>
              )}
              {tenant.status === 'suspended' && (
                <button onClick={onReativar} className="btn-ghost">
                  <CheckCircle size={14} />
                  Reativar
                </button>
              )}
              <button
                onClick={() => window.open(`/cardapio/${tenant.slug}`, '_blank')}
                className="btn-ghost"
              >
                <Eye size={14} />
                Ver cardápio
              </button>
              <button onClick={onDeletar} className="btn-ghost" style={{ color: '#DC2626' }}>
                <Trash2 size={14} />
                Deletar
              </button>
            </div>
          </div>
        ) : (
          // Modo edição
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Nome do negócio"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
              <InputField
                label="Slug (URL)"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <InputField
                label="Nova senha (deixe vazio pra manter)"
                type="text"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="mín. 6 caracteres"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Categoria"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectField>
              <InputField
                label="Telefone / WhatsApp"
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Estado"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value, cidade: '' })}
              >
                <option value="">Selecione</option>
                {ESTADOS_LIST.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </SelectField>
              <SearchableSelect
                label="Cidade"
                options={cidades}
                value={form.cidade}
                onChange={(v) => setForm({ ...form, cidade: v })}
                placeholder="Selecione"
                disabled={!form.estado}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <InputField
                label="Endereço"
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua, avenida..."
              />
              <InputField
                label="Número"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="123"
              />
              <InputField
                label="Complemento"
                value={form.complemento}
                onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                placeholder="Apto, sala..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Nome do responsável"
                value={form.nome_responsavel}
                onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })}
              />
              <InputField
                label="CPF"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <InputField
                label="Mensalidade (R$)"
                type="number"
                step="0.01"
                value={form.valor_mensalidade}
                onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value })}
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="pending_approval">Aguardando aprovação</option>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
              </SelectField>
              <SelectField
                label="Pagamento"
                value={form.status_pagamento}
                onChange={(e) => setForm({ ...form, status_pagamento: e.target.value })}
              >
                <option value="pago">Em dia</option>
                <option value="pendente">Pendente</option>
              </SelectField>
            </div>

            <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
              <button onClick={() => setEditing(false)} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================
   MODAL: NOVO LOJISTA
   ================================================ */
function ModalNovoLojista({ onClose, onSuccess }: any) {
  const [loading, setLoading] = useState(false)
  const [cidades, setCidades] = useState<string[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '',
    slug: '',
    email: '',
    password: '',
    categoria: 'Outros',
    telefone: '',
    estado: '',
    cidade: '',
    endereco: '',
    numero: '',
    nome_responsavel: '',
    cpf: '',
    valor_mensalidade: '99.90',
  })

  useEffect(() => {
    if (!form.estado) {
      setCidades([])
      return
    }
    let cancelled = false
    import('@/lib/cidades-brasil').then(mod => {
      mod.getCidadesByEstado(form.estado).then((lista) => {
        if (!cancelled) setCidades(lista)
      })
    })
    return () => { cancelled = true }
  }, [form.estado])

  const handleSubmit = async () => {
    setError('')
    if (form.password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres')
      return
    }
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao criar lojista')
        setLoading(false)
        return
      }
      alert(`✅ Lojista "${form.nome}" criado!\n\nEle já pode fazer login com o email e senha definidos.\n\nEmail: ${form.email}\nSenha: ${form.password}`)
      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Erro de rede')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass p-6 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              Novo Lojista
            </h2>
            <p className="hint text-xs mt-1">Lojista criado aqui já nasce aprovado e pode logar na hora.</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-2xl text-[13px]"
            style={{ background: 'rgba(220,38,38,.08)', color: '#991B1B', border: '1px solid rgba(220,38,38,.25)' }}
          >
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Nome do negócio"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/\s/g, '-') })}
              required
            />
            <InputField
              label="Slug (URL)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Email de acesso"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <InputField
              label="Senha inicial"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              placeholder="mín. 6 caracteres"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Categoria"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </SelectField>
            <InputField
              label="Telefone / WhatsApp"
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Estado"
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value, cidade: '' })}
            >
              <option value="">Selecione</option>
              {ESTADOS_LIST.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </SelectField>
            <SearchableSelect
              label="Cidade"
              options={cidades}
              value={form.cidade}
              onChange={(v) => setForm({ ...form, cidade: v })}
              placeholder="Selecione"
              disabled={!form.estado}
            />
          </div>

          <InputField
            label="Endereço completo"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            placeholder="Rua, número, bairro"
          />

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Número"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              placeholder="123"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Nome do responsável"
              value={form.nome_responsavel}
              onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })}
            />
            <InputField
              label="CPF"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
              placeholder="000.000.000-00"
            />
          </div>

          <InputField
            label="Mensalidade (R$)"
            type="number"
            step="0.01"
            value={form.valor_mensalidade}
            onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value })}
          />

          <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
            <button onClick={onClose} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Criando...' : 'Criar lojista'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--line)' }}>
      <span className="hint">{label}</span>
      <span className="font-medium text-sm text-right max-w-[60%]" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}
