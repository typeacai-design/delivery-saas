'use client'

import { useState } from 'react'
import { Check, Truck, X, Clock, Printer, MessageCircle, Pencil, Trash2, Eye, History } from 'lucide-react'
import { Pedido, PedidoStatus } from '@/types'
import { formatCurrency } from '@/lib/utils'

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  novo: { label: 'Novo', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', icon: Clock },
  preparando: { label: 'Preparando', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300', icon: Clock },
  pronto: { label: 'Pronto', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300', icon: Check },
  saiu: { label: 'Saiu', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300', icon: Truck },
  entregue: { label: 'Entregue', color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-300', icon: Check },
  cancelado: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: X },
}

type Props = {
  pedidos: Pedido[]
  onAbrirModalEditar: (pedido: Pedido) => void
  onAbrirModalDesconto: (pedido: Pedido) => void
  onImprimir: (pedido: Pedido) => void
  onConfirmarWPP: (pedido: Pedido) => void
  onApagar: (pedido: Pedido) => void
  onAbrirDetalhes: (pedido: Pedido) => void
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(date: string) {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoricoTab({ pedidos, onAbrirModalEditar, onAbrirModalDesconto, onImprimir, onConfirmarWPP, onApagar, onAbrirDetalhes }: Props) {
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroDataDe, setFiltroDataDe] = useState<string>(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [filtroDataAte, setFiltroDataAte] = useState<string>(new Date().toISOString().split('T')[0])
  const [busca, setBusca] = useState('')

  const STATUS_HISTORICO: PedidoStatus[] = ['entregue', 'cancelado']

  // Métricas
  const entregados = pedidos.filter(p => p.status === 'entregue')
  const cancelados = pedidos.filter(p => p.status === 'cancelado')
  const faturamento = entregados.reduce((acc, p) => acc + Number(p.valor_total), 0)

  let filtrados = pedidos.filter((p) => STATUS_HISTORICO.includes(p.status))

  if (filtroStatus) {
    filtrados = filtrados.filter((p) => p.status === filtroStatus)
  }

  if (filtroDataDe && filtroDataAte) {
    filtrados = filtrados.filter((p) => {
      const data = new Date(p.data_criacao).toISOString().split('T')[0]
      return data >= filtroDataDe && data <= filtroDataAte
    })
  }

  if (busca.trim()) {
    const termo = busca.toLowerCase()
    filtrados = filtrados.filter((p) => {
      const nome = ((p as any).cliente_nome || '').toLowerCase()
      const codigo = ((p as any).codigo || '').toLowerCase()
      const whatsapp = ((p as any).cliente_whatsapp || '').toLowerCase()
      return nome.includes(termo) || codigo.includes(termo) || whatsapp.includes(termo)
    })
  }

  // Ordenar do mais recente ao mais antigo
  filtrados = [...filtrados].sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime())

  const formatFormaPagamento = (forma: any) => {
    if (Array.isArray(forma)) return forma.join(', ')
    return forma || '-'
  }

  return (
    <div>
      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Pedidos entregues</p>
          <p className="text-2xl font-bold text-gray-900">{entregados.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Cancelados</p>
          <p className="text-2xl font-bold text-red-600">{cancelados.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Faturamento</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(faturamento)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4 bg-white p-3 rounded-xl border shadow-sm flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">📅 De:</label>
          <input
            type="date"
            value={filtroDataDe}
            onChange={(e) => setFiltroDataDe(e.target.value)}
            className="form-input text-sm px-3 py-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Até:</label>
          <input
            type="date"
            value={filtroDataAte}
            onChange={(e) => setFiltroDataAte(e.target.value)}
            className="form-input text-sm px-3 py-1.5"
          />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, código..."
            className="form-input text-sm px-3 py-1.5 flex-1"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setFiltroDataDe(d.toISOString().split('T')[0]); setFiltroDataAte(new Date().toISOString().split('T')[0]) }}
            className="px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            7 dias
          </button>
          <button
            onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setFiltroDataDe(d.toISOString().split('T')[0]); setFiltroDataAte(new Date().toISOString().split('T')[0]) }}
            className="px-2 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
          >
            30 dias
          </button>
        </div>
      </div>

      {/* Stats de status */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFiltroStatus(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${!filtroStatus ? 'bg-gray-600 text-white shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
        >
          Todos
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100">{STATUS_HISTORICO.length > 0 ? pedidos.filter(p => STATUS_HISTORICO.includes(p.status)).length : 0}</span>
        </button>
        <button
          onClick={() => setFiltroStatus(filtroStatus === 'entregue' ? null : 'entregue')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${filtroStatus === 'entregue' ? 'bg-gray-100 text-gray-700 shadow-md border-gray-400' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
        >
          <Check className="w-3 h-3" />
          Entregues
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100">{entregados.length}</span>
        </button>
        <button
          onClick={() => setFiltroStatus(filtroStatus === 'cancelado' ? null : 'cancelado')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${filtroStatus === 'cancelado' ? 'bg-red-100 text-red-700 shadow-md border-red-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
        >
          <X className="w-3 h-3" />
          Cancelados
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100">{cancelados.length}</span>
        </button>
      </div>

      {/* Info de filtro */}
      <div className="mb-3 text-sm text-gray-500">
        {filtrados.length} pedido{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
        {(filtroStatus || busca) && (
          <button onClick={() => { setFiltroStatus(null); setBusca('') }} className="ml-2 text-blue-600 hover:underline">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Lista em tabela */}
      {filtrados.length > 0 ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Data</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Pagamento</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((pedido) => {
                  const config = STATUS_CONFIG[pedido.status]
                  const StatusIcon = config.icon
                  return (
                    <tr key={pedido.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {(pedido as any).codigo || ('#' + pedido.id.slice(0, 8))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{(pedido as any).cliente_nome || '-'}</div>
                        {(pedido as any).cliente_whatsapp && (
                          <div className="text-xs text-gray-500">📱 {(pedido as any).cliente_whatsapp}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {formatDate(pedido.data_criacao)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                        {formatFormaPagamento((pedido as any).forma_pagamento)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(pedido.valor_total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onAbrirDetalhes(pedido)}
                            className="size-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                            title="Ver detalhes"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => onConfirmarWPP(pedido)}
                            className="size-8 rounded-lg hover:bg-green-50 flex items-center justify-center text-green-600"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            onClick={() => onImprimir(pedido)}
                            className="size-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                            title="Imprimir"
                          >
                            <Printer size={14} />
                          </button>
                          {pedido.status === 'cancelado' ? (
                            <button
                              onClick={() => onApagar(pedido)}
                              className="size-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500"
                              title="Apagar pedido"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => onAbrirModalEditar(pedido)}
                                className="size-8 rounded-lg hover:bg-indigo-50 flex items-center justify-center text-indigo-500"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido no histórico</h3>
          <p className="hint">Pedidos entregues ou cancelados aparecerão aqui</p>
        </div>
      )}
    </div>
  )
}
