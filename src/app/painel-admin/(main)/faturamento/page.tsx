'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Users, Building2, Calendar, Download, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import { adminFetch } from '@/lib/admin-fetch'
import { formatCurrency } from '@/lib/utils'

interface TenantFaturamento {
  id: string
  nome: string
  slug: string
  email: string
  status: string
  status_pagamento: string
  total_faturamento: number
  comissao_1_percent: number
  ultimo_pedido: string | null
  total_pedidos: number
}

export default function FaturamentoPage() {
  const [tenants, setTenants] = useState<TenantFaturamento[]>([])
  const [loading, setLoading] = useState(true)
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date()
    d.setDate(1) // Primeiro dia do mês
    return d.toISOString().split('T')[0]
  })
  const [dataFim, setDataFim] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchFaturamento = async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`/api/admin/faturamento?inicio=${dataInicio}&fim=${dataFim}`)
      const data = await res.json()
      setTenants(data.tenants || [])
    } catch (error) {
      console.error('Erro ao buscar faturamento:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFaturamento()
  }, [])

  const totalGeral = tenants.reduce((s, t) => s + t.total_faturamento, 0)
  const totalComissao = tenants.reduce((s, t) => s + t.comissao_1_percent, 0)
  const totalPago = tenants.filter(t => t.status_pagamento === 'pago').reduce((s, t) => s + t.comissao_1_percent, 0)
  const totalPendente = totalComissao - totalPago

  const marcarPago = async (tenant: TenantFaturamento) => {
    if (!confirm(`Marcar como pago a comissão de ${formatCurrency(tenant.comissao_1_percent)} de ${tenant.nome}?`)) return

    setProcessing(tenant.id)
    try {
      await adminFetch('/api/admin/faturamento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id, pago: true }),
      })
      fetchFaturamento()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao marcar como pago')
    } finally {
      setProcessing(null)
    }
  }

  const desmarcarPago = async (tenant: TenantFaturamento) => {
    if (!confirm(`Desmarcar pagamento da comissão de ${tenant.nome}?`)) return

    setProcessing(tenant.id)
    try {
      await adminFetch('/api/admin/faturamento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id, pago: false }),
      })
      fetchFaturamento()
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Financeiro</div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>Cobrança 1%</h1>
          <p className="hint mt-1">Faturamento e comissão dos lojistas</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="form-input" />
          <span className="text-gray-500">até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="form-input" />
          <button onClick={fetchFaturamento} className="btn-ghost" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><DollarSign size={12} /> Total Faturamento</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{formatCurrency(totalGeral)}</div>
          <p className="hint text-xs mt-1">Período selecionado</p>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><TrendingUp size={12} /> Comissão 1%</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalComissao)}</div>
          <p className="hint text-xs mt-1">{tenants.length} lojistas</p>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><Check size={12} /> Cobrado</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPago)}</div>
          <p className="hint text-xs mt-1">{tenants.filter(t => t.status_pagamento === 'pago').length} lojistas</p>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Pendente</div>
          <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendente)}</div>
          <p className="hint text-xs mt-1">{tenants.filter(t => t.status_pagamento !== 'pago').length} lojistas</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="glass p-6">
        <h2 className="text-lg font-semibold mb-4">Detalhamento por Lojista</h2>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Lojista</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Faturamento</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Comissão 1%</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-600">Pedidos</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-600">Status</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-600">Ação</th>
                </tr>
              </thead>
              <tbody>
                {tenants.sort((a, b) => b.total_faturamento - a.total_faturamento).map(tenant => (
                  <tr key={tenant.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <div className="font-medium">{tenant.nome}</div>
                      <div className="text-xs text-gray-500">{tenant.email}</div>
                    </td>
                    <td className="py-3 px-2 text-right font-semibold">
                      {formatCurrency(tenant.total_faturamento)}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-green-600">
                      {formatCurrency(tenant.comissao_1_percent)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {tenant.total_pedidos}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        tenant.status_pagamento === 'pago'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {tenant.status_pagamento === 'pago' ? 'Pago ✓' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {tenant.status_pagamento === 'pago' ? (
                        <button
                          onClick={() => desmarcarPago(tenant)}
                          disabled={processing === tenant.id}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          Desmarcar
                        </button>
                      ) : (
                        <button
                          onClick={() => marcarPago(tenant)}
                          disabled={processing === tenant.id}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {processing === tenant.id ? '...' : 'Marcar Pago'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Nenhum lojista encontrado no período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
