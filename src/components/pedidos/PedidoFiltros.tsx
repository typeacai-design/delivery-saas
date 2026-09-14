'use client'

import { memo } from 'react'
import { Filter, Calendar, RefreshCw } from 'lucide-react'

interface PedidoStatsProps {
  stats: {
    novo: number
    preparando: number
    pronto: number
    saiu: number
    total: number
  }
  isLoading: boolean
}

export const PedidoStats = memo(function PedidoStats({ stats, isLoading }: PedidoStatsProps) {
  const badges = [
    { label: 'Novos', value: stats.novo, color: '#B55C00', bg: '#FFF7E8' },
    { label: 'Preparando', value: stats.preparando, color: '#B45309', bg: '#FEF3C7' },
    { label: 'Prontos', value: stats.pronto, color: '#15803D', bg: '#DCFCE7' },
    { label: 'Saiu', value: stats.saiu, color: '#1D4ED8', bg: '#DBEAFE' },
  ]

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      {badges.map((b) => (
        <div
          key={b.label}
          className="px-4 py-2 rounded-xl flex items-center gap-2"
          style={{ background: b.bg }}
        >
          <span className="text-xs font-medium" style={{ color: b.color }}>{b.label}</span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: b.color }}
          >
            {isLoading ? '-' : b.value}
          </span>
        </div>
      ))}
    </div>
  )
})

interface PedidoFiltrosProps {
  filtroDataDe: string
  filtroDataAte: string
  filtroPeriodo: 'hoje' | 'ontem' | 'todos'
  pedidosTab: 'pedidos' | 'mesas'
  onFiltroDataDeChange: (v: string) => void
  onFiltroDataAteChange: (v: string) => void
  onFiltroPeriodoChange: (v: 'hoje' | 'ontem' | 'todos') => void
  onPedidosTabChange: (v: 'pedidos' | 'mesas') => void
  onRefresh: () => void
  isLoading: boolean
}

export const PedidoFiltros = memo(function PedidoFiltros({
  filtroDataDe,
  filtroDataAte,
  filtroPeriodo,
  pedidosTab,
  onFiltroDataDeChange,
  onFiltroDataAteChange,
  onFiltroPeriodoChange,
  onPedidosTabChange,
  onRefresh,
  isLoading,
}: PedidoFiltrosProps) {
  const tabs = [
    { key: 'pedidos', label: 'Pedidos' },
    { key: 'mesas', label: 'Mesas' },
  ] as const

  const periodos = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'ontem', label: 'Ontem' },
    { key: 'todos', label: 'Todos' },
  ] as const

  return (
    <div className="mb-6 space-y-3">
      {/* Tabs de seção */}
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onPedidosTabChange(tab.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
              pedidosTab === tab.key ? 'bg-white shadow-sm' : ''
            }`}
            style={{ color: pedidosTab === tab.key ? '#172033' : '#697386' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Período rápido */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#F1F5F9' }}>
          {periodos.map((p) => (
            <button
              key={p.key}
              onClick={() => onFiltroPeriodoChange(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                filtroPeriodo === p.key ? 'bg-white shadow-sm' : ''
              }`}
              style={{ color: filtroPeriodo === p.key ? '#172033' : '#697386' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#697386' }} />
            <input
              type="date"
              value={filtroDataDe}
              onChange={(e) => onFiltroDataDeChange(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg text-sm border"
              style={{ borderColor: '#E4E8EE', color: '#172033' }}
            />
          </div>
          <span style={{ color: '#697386' }}>—</span>
          <input
            type="date"
            value={filtroDataAte}
            onChange={(e) => onFiltroDataAteChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border"
            style={{ borderColor: '#E4E8EE', color: '#172033' }}
          />
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="ml-auto px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
          style={{ background: '#172033', color: '#FFFFFF' }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>
    </div>
  )
})
