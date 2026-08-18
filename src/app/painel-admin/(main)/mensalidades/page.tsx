'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Search, Filter, Plus, CheckCircle, AlertTriangle, Calendar, TrendingUp, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { adminFetch } from '@/lib/admin-fetch'

export default function MensalidadesPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'pagos'>('todos')
  const [mes, setMes] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [tenantsRes, pagamentosRes] = await Promise.all([
        adminFetch('/api/admin/tenants'),
        adminFetch('/api/admin/pagamentos')
      ])
      const tenantsData = await tenantsRes.json()
      const pagamentosData = await pagamentosRes.json()
      setTenants(tenantsData.tenants || [])
      setPagamentos(pagamentosData.pagamentos || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const pendentes = tenants.filter(t => t.status_pagamento !== 'pago')
  const pagos = tenants.filter(t => t.status_pagamento === 'pago')

  const filteredTenants = tenants.filter(t => {
    if (filtro === 'pendentes') return t.status_pagamento !== 'pago'
    if (filtro === 'pagos') return t.status_pagamento === 'pago'
    return true
  })

  const totalPendente = pendentes.reduce((acc, t) => acc + Number(t.valor_mensalidade || 99.90), 0)
  const totalRecebido = pagos.reduce((acc, t) => acc + Number(t.valor_mensalidade || 99.90), 0)

  const marcarPago = async (id: string) => {
    try {
      await adminFetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status_pagamento: 'pago' })
      })
      fetchData()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const mesAnterior = () => {
    const newMes = new Date(mes)
    newMes.setMonth(newMes.getMonth() - 1)
    setMes(newMes)
  }

  const proximoMes = () => {
    const newMes = new Date(mes)
    newMes.setMonth(newMes.getMonth() + 1)
    setMes(newMes)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Financeiro</div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>Mensalidades</h1>
          <p className="hint mt-1">Controle de pagamentos dos lojistas</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-2">
            <Download size={14} />
            Exportar
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} />
            Registrar Pagamento
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.12)' }}>
              <DollarSign size={18} style={{ color: 'var(--green)' }} />
            </div>
            <span className="hint">Total Recebido</span>
          </div>
          <p className="text-2xl font-bold gradient-text">{formatCurrency(totalRecebido)}</p>
          <p className="hint text-xs mt-1">{pagos.length} lojistas em dia</p>
        </div>

        <div className="glass p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,.12)' }}>
              <AlertTriangle size={18} style={{ color: '#DC2626' }} />
            </div>
            <span className="hint">Total Pendente</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalPendente)}</p>
          <p className="hint text-xs mt-1">{pendentes.length} lojistas inadimplentes</p>
        </div>

        <div className="glass p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,.12)' }}>
              <TrendingUp size={18} style={{ color: '#3b82f6' }} />
            </div>
            <span className="hint">Taxa de Cobrança</span>
          </div>
          <p className="text-2xl font-bold">{((pagos.length / Math.max(tenants.length, 1)) * 100).toFixed(0)}%</p>
          <p className="hint text-xs mt-1">{tenants.length} lojistas total</p>
        </div>
      </div>

      {/* Seletor de Mês */}
      <div className="glass p-4 rounded-2xl flex items-center justify-between">
        <button onClick={mesAnterior} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-semibold">{mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={proximoMes} className="btn-ghost p-2">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltro('todos')} className={`btn-ghost ${filtro === 'todos' ? '' : 'opacity-60'}`}>
          Todos ({tenants.length})
        </button>
        <button onClick={() => setFiltro('pagos')} className={`btn-ghost ${filtro === 'pagos' ? '' : 'opacity-60'}`}>
          <CheckCircle size={14} />
          Pagos ({pagos.length})
        </button>
        <button onClick={() => setFiltro('pendentes')} className={`btn-ghost ${filtro === 'pendentes' ? '' : 'opacity-60'}`}>
          <AlertTriangle size={14} />
          Pendentes ({pendentes.length})
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="glass-soft p-12 text-center rounded-2xl">
          <p className="hint">Carregando...</p>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="glass-soft p-12 text-center rounded-2xl">
          <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--ink-muted)' }} />
          <p className="hint font-medium">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTenants.map((tenant) => (
            <div key={tenant.id} className="glass-soft p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl flex items-center justify-center font-bold text-white" style={{ background: 'var(--green)' }}>
                    {tenant.nome?.[0]?.toUpperCase() || 'L'}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>{tenant.nome}</p>
                    <p className="hint text-sm">@{tenant.slug} · Vence dia 10</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold gradient-text">{formatCurrency(Number(tenant.valor_mensalidade) || 99.90)}</p>
                    <p className="hint text-xs">{tenant.status_pagamento === 'pago' ? 'Pago' : 'Aguardando'}</p>
                  </div>
                  {tenant.status_pagamento !== 'pago' ? (
                    <button onClick={() => marcarPago(tenant.id)} className="btn-primary text-sm">
                      <CheckCircle size={14} />
                      Quitar
                    </button>
                  ) : (
                    <span className="chip chip--positive">Quitado</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ModalRegistroPagamento
          tenants={tenants}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData() }}
        />
      )}
    </div>
  )
}

function ModalRegistroPagamento({ tenants, onClose, onSuccess }: {
  tenants: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [tenantId, setTenantId] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await adminFetch('/api/admin/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, valor, data_pagamento: data })
      })
      await adminFetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tenantId, status_pagamento: 'pago' })
      })
      onSuccess()
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass p-6 rounded-3xl w-full max-w-md">
        <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--ink)' }}>Registrar Pagamento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Lojista</label>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
              <option value="">Selecione...</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </div>
          <div>
            <label>Data do Pagamento</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
