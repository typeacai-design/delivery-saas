'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Download, Calendar, DollarSign, Users, ShoppingBag, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { adminFetch } from '@/lib/admin-fetch'

export default function RelatoriosPage() {
  const [data, setData] = useState<any>({
    tenants: [],
    pedidos: [],
    pagamentos: []
  })
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d' | 'ano'>('30d')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [tenantsRes, pedidosRes, pagamentosRes] = await Promise.all([
        adminFetch('/api/admin/tenants'),
        adminFetch('/api/admin/pedidos'),
        adminFetch('/api/admin/pagamentos')
      ])
      const tenantsData = await tenantsRes.json()
      const pedidosData = await pedidosRes.json()
      const pagamentosData = await pagamentosRes.json()

      setData({
        tenants: tenantsData.tenants || [],
        pedidos: pedidosData.pedidos || [],
        pagamentos: pagamentosData.pagamentos || []
      })
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateLimit = () => {
    const now = new Date()
    switch (periodo) {
      case '7d': return new Date(now.setDate(now.getDate() - 7))
      case '30d': return new Date(now.setDate(now.getDate() - 30))
      case '90d': return new Date(now.setDate(now.getDate() - 90))
      case 'ano': return new Date(now.setFullYear(now.getFullYear() - 1))
      default: return new Date(now.setDate(now.getDate() - 30))
    }
  }

  const dateLimit = getDateLimit()
  const pedidosPeriodo = data.pedidos.filter((p: any) => new Date(p.data_criacao) >= dateLimit)

  // Métricas calculadas
  const totalVendas = pedidosPeriodo.reduce((acc: number, p: any) => acc + Number(p.valor_total || 0), 0)
  const totalPedidos = pedidosPeriodo.length
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0

  // Lojistas novos no período
  const novosLojistas = data.tenants.filter((t: any) => new Date(t.created_at) >= dateLimit)

  // Inadimplência
  const inadimplentes = data.tenants.filter((t: any) => t.status_pagamento !== 'pago').length
  const taxaInadimplencia = data.tenants.length > 0 ? (inadimplentes / data.tenants.length) * 100 : 0

  // Dados para gráfico de vendas por dia
  const vendasPorDia = getVendasPorDia(pedidosPeriodo)

  // Dados para gráfico de top lojistas
  const topLojistas = getTopLojistas(pedidosPeriodo, data.tenants)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Análises</div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>Relatórios</h1>
          <p className="hint mt-1">Dados e métricas do seu SaaS</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-2">
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Seletor de Período */}
      <div className="glass p-4 rounded-2xl flex items-center gap-3">
        <Calendar size={18} style={{ color: 'var(--ink-muted)' }} />
        <span className="hint font-medium">Período:</span>
        {(['7d', '30d', '90d', 'ano'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`btn-ghost text-sm ${periodo === p ? '' : 'opacity-60'}`}
          >
            {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : '1 ano'}
          </button>
        ))}
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Faturamento"
          value={formatCurrency(totalVendas)}
          sublabel={`${totalPedidos} pedidos`}
          color="green"
        />
        <MetricCard
          icon={ShoppingBag}
          label="Pedidos"
          value={totalPedidos.toString()}
          sublabel={`Ticket médio: ${formatCurrency(ticketMedio)}`}
          color="blue"
        />
        <MetricCard
          icon={Users}
          label="Novos Lojistas"
          value={novosLojistas.length.toString()}
          sublabel={`${data.tenants.length} total`}
          color="purple"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Inadimplência"
          value={`${taxaInadimplencia.toFixed(1)}%`}
          sublabel={`${inadimplentes} lojistas`}
          color="red"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendas por Dia */}
        <div className="glass p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>Vendas por Dia</h2>
            <TrendingUp size={18} style={{ color: 'var(--green)' }} />
          </div>
          {vendasPorDia.length === 0 ? (
            <div className="text-center py-8">
              <p className="hint">Sem dados para este período</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vendasPorDia.slice(-7).map((venda: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="hint text-xs w-20">{venda.dia}</span>
                  <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: 'rgba(22,163,74,.1)' }}>
                    <div
                      className="h-full rounded-lg transition-all"
                      style={{
                        width: `${(venda.valor / Math.max(...vendasPorDia.map((v: any) => v.valor))) * 100}%`,
                        background: 'var(--green)'
                      }}
                    />
                  </div>
                  <span className="hint text-xs font-medium w-20 text-right">{formatCurrency(venda.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Lojistas */}
        <div className="glass p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>Top Lojistas</h2>
            <BarChart3 size={18} style={{ color: 'var(--green)' }} />
          </div>
          {topLojistas.length === 0 ? (
            <div className="text-center py-8">
              <p className="hint">Sem dados para este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topLojistas.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="size-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--green)', opacity: 1 - (i * 0.15) }}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.nome}</p>
                    <p className="hint text-xs">{item.pedidos} pedidos</p>
                  </div>
                  <span className="font-semibold gradient-text">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--ink)' }}>Resumo Geral</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="hint text-xs">Total de Lojistas</p>
            <p className="text-xl font-bold">{data.tenants.length}</p>
          </div>
          <div>
            <p className="hint text-xs">Em Dia</p>
            <p className="text-xl font-bold" style={{ color: 'var(--green)' }}>{data.tenants.length - inadimplentes}</p>
          </div>
          <div>
            <p className="hint text-xs">Inadimplentes</p>
            <p className="text-xl font-bold text-red-500">{inadimplentes}</p>
          </div>
          <div>
            <p className="hint text-xs">Total de Pedidos</p>
            <p className="text-xl font-bold">{data.pedidos.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sublabel, color }: {
  icon: any
  label: string
  value: string
  sublabel: string
  color: 'green' | 'blue' | 'purple' | 'red'
}) {
  const colors = {
    green: { bg: 'rgba(22,163,74,.12)', icon: 'var(--green)' },
    blue: { bg: 'rgba(59,130,246,.12)', icon: '#3b82f6' },
    purple: { bg: 'rgba(168,85,247,.12)', icon: '#a855f7' },
    red: { bg: 'rgba(220,38,38,.12)', icon: '#ef4444' }
  }

  return (
    <div className="glass-soft p-4 rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: colors[color].bg }}>
          <Icon size={16} style={{ color: colors[color].icon }} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: color === 'green' ? 'var(--green)' : color === 'red' ? '#ef4444' : 'var(--ink)' }}>{value}</p>
      <p className="hint text-xs mt-1">{label}</p>
      <p className="hint text-xs" style={{ color: 'var(--ink-muted)' }}>{sublabel}</p>
    </div>
  )
}

function getVendasPorDia(pedidos: any[]) {
  const dias: Record<string, number> = {}

  pedidos.forEach(p => {
    const dia = new Date(p.data_criacao).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })
    dias[dia] = (dias[dia] || 0) + Number(p.valor_total || 0)
  })

  return Object.entries(dias).map(([dia, valor]) => ({ dia, valor }))
}

function getTopLojistas(pedidos: any[], tenants: any[]) {
  const totais: Record<string, number> = {}
  const contagem: Record<string, number> = {}

  pedidos.forEach(p => {
    totais[p.tenant_id] = (totais[p.tenant_id] || 0) + Number(p.valor_total || 0)
    contagem[p.tenant_id] = (contagem[p.tenant_id] || 0) + 1
  })

  return tenants
    .map(t => ({
      id: t.id,
      nome: t.nome,
      total: totais[t.id] || 0,
      pedidos: contagem[t.id] || 0
    }))
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)
}
