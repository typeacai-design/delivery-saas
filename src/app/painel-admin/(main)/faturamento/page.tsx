'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Users, Building2, Calendar, Download, Check, AlertTriangle, RefreshCw, Play, Clock } from 'lucide-react'
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
  previsao_comissao: number
  total_pedidos: number
}

interface FaturamentoData {
  data_referencia: string
  dias_ate_cobranca: number
  data_proxima_cobranca: string
  tenants: TenantFaturamento[]
  totais: {
    faturamento_total: number
    previsao_comissao_total: number
  }
}

export default function FaturamentoPage() {
  const [data, setData] = useState<FaturamentoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchFaturamento = async () => {
    try {
      const res = await adminFetch('/api/admin/faturamento')
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const gerarComissoes = async () => {
    if (!confirm('Gerar comissões de 1% sobre o faturamento do mês atual para todos os lojistas?')) return
    setGerando(true)
    try {
      const res = await fetch('/api/cron/gerar-comissoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      alert(json.message || `${json.geradas} comissões geradas`)
      fetchFaturamento()
    } catch (err) {
      alert('Erro ao gerar comissões')
    } finally {
      setGerando(false)
    }
  }

  useEffect(() => {
    fetchFaturamento()
    if (autoRefresh) {
      const interval = setInterval(fetchFaturamento, 30000) // 30 segundos
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const marcarPago = async (tenant: TenantFaturamento) => {
    if (!confirm(`Marcar como paga a comissão de ${formatCurrency(tenant.comissao_1_percent)} de ${tenant.nome}?`)) return
    setProcessing(tenant.id)
    try {
      await adminFetch('/api/admin/faturamento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id, pago: true }),
      })
      fetchFaturamento()
    } catch (error) {
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
          <p className="hint mt-1">Comissão sobre o faturamento dos lojistas (tempo real)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`btn-ghost text-sm ${autoRefresh ? 'text-green-600' : ''}`}>
            <RefreshCw size={14} className={autoRefresh && loading ? 'animate-spin' : ''} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button onClick={gerarComissoes} disabled={gerando} className="btn-primary text-sm">
            <Play size={14} />
            {gerando ? 'Gerando...' : 'Gerar Comissões'}
          </button>
        </div>
      </div>

      {/* Banner de Próxima Cobrança */}
      {data && (
        <div className="glass p-5 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="size-12 rounded-2xl bg-green-500 flex items-center justify-center text-white">
              <Calendar size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Próxima Cobrança Automática</h3>
              <p className="text-sm text-gray-600">
                <strong>Dia {new Date(data.data_proxima_cobranca).toLocaleDateString('pt-BR')}</strong>
                {' '}— {data.dias_ate_cobranca > 0 ? `faltam ${data.dias_ate_cobranca} dias` : 'hoje!'}
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl">
              <Clock size={16} className="text-green-600" />
              <span className="font-bold text-green-700">{data.dias_ate_cobranca} dias</span>
            </div>
          </div>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><DollarSign size={12} /> Faturamento Total</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            {formatCurrency(data?.totais.faturamento_total || 0)}
          </div>
          <p className="hint text-xs mt-1">Mês atual (atualizado)</p>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><TrendingUp size={12} /> Comissão 1%</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(data?.totais.previsao_comissao_total || 0)}
          </div>
          <p className="hint text-xs mt-1">Previsão para {data?.data_proxima_cobranca ? new Date(data.data_proxima_cobranca).toLocaleDateString('pt-BR') : 'dia 05'}</p>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><Users size={12} /> Lojistas Ativos</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            {data?.tenants.length || 0}
          </div>
          <p className="hint text-xs mt-1">Com faturamento no mês</p>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><Building2 size={12} /> Percentual</div>
          <div className="text-2xl font-bold text-blue-600">1,00%</div>
          <p className="hint text-xs mt-1">Sobre faturamento total</p>
        </div>
      </div>

      {/* Tabela Detalhada */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Detalhamento por Lojista (Tempo Real)</h2>
          <button onClick={fetchFaturamento} className="btn-ghost text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar agora
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-8 text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Lojista</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Faturamento (Mês)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Pedidos</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Previsão 1%</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-600">Status</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-600">Ação</th>
                </tr>
              </thead>
              <tbody>
                {data?.tenants.sort((a, b) => b.total_faturamento - a.total_faturamento).map(tenant => (
                  <tr key={tenant.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <div className="font-medium">{tenant.nome}</div>
                      <div className="text-xs text-gray-500">{tenant.email}</div>
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-blue-600">
                      {formatCurrency(tenant.total_faturamento)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {tenant.total_pedidos}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-green-600">
                      {formatCurrency(tenant.previsao_comissao || tenant.comissao_1_percent)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        tenant.status_pagamento === 'pago'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {tenant.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'}
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
                {(data?.tenants.length || 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Nenhum lojista com faturamento no mês atual
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 text-center">
        💡 Atualização automática a cada 30 segundos • Próxima cobrança dia 05 via Vercel Cron
      </div>
    </div>
  )
}
