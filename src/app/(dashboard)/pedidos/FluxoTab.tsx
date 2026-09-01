'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Clock, Check, Truck, X, Eye, ChevronRight, MessageCircle,
  Printer, Tag, Pencil, Trash2, AlertTriangle, Percent, MessageSquare
} from 'lucide-react'
import { Pedido, PedidoStatus } from '@/types'
import { formatCurrency } from '@/lib/utils'
import ItensPedido from './ItensPedido'

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  novo: { label: 'Novo', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', icon: Clock },
  preparando: { label: 'Preparando', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300', icon: Clock },
  pronto: { label: 'Pronto', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300', icon: Check },
  saiu: { label: 'Saiu', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300', icon: Truck },
  entregue: { label: 'Entregue', color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-300', icon: Check },
  cancelado: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: X },
}

const NEXT_STATUS: Record<PedidoStatus, PedidoStatus | null> = {
  novo: 'preparando',
  preparando: 'pronto',
  pronto: 'saiu',
  saiu: 'entregue',
  entregue: null,
  cancelado: null,
}

type Props = {
  pedidos: Pedido[]
  onUpdateStatus: (pedido: Pedido, status: PedidoStatus) => void
  onTogglePago: (pedido: Pedido) => void
  onAbrirModalDesconto: (pedido: Pedido) => void
  onAbrirModalEditar: (pedido: Pedido) => void
  onAbrirModalCancelamento: (pedido: Pedido) => void
  onImprimir: (pedido: Pedido) => void
  onConfirmarWPP: (pedido: Pedido) => void
  onApagar: (pedido: Pedido) => void
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatFormaPagamento(forma: any) {
  if (Array.isArray(forma)) return forma.map((f: string) => f || 'N/A').join(', ')
  return forma || '-'
}

export default function FluxoTab({ pedidos, onUpdateStatus, onTogglePago, onAbrirModalDesconto, onAbrirModalEditar, onAbrirModalCancelamento, onImprimir, onConfirmarWPP, onApagar }: Props) {
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroDataDe, setFiltroDataDe] = useState<string>(new Date().toISOString().split('T')[0])
  const [filtroDataAte, setFiltroDataAte] = useState<string>(new Date().toISOString().split('T')[0])

  const STATUS_EM_ABERTO: PedidoStatus[] = ['novo', 'preparando', 'pronto', 'saiu']
  const STATUS_LISTA: PedidoStatus[] = ['novo', 'preparando', 'pronto', 'saiu']

  let filtrados = pedidos.filter((p) => STATUS_EM_ABERTO.includes(p.status))

  if (filtroStatus) {
    filtrados = filtrados.filter((p) => p.status === filtroStatus)
  }

  if (filtroDataDe && filtroDataAte) {
    filtrados = filtrados.filter((p) => {
      const data = new Date(p.data_criacao).toISOString().split('T')[0]
      return data >= filtroDataDe && data <= filtroDataAte
    })
  }

  return (
    <div>
      {/* Filtro de Data */}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const hoje = new Date().toISOString().split('T')[0]; setFiltroDataDe(hoje); setFiltroDataAte(hoje) }}
            className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_LISTA.map((status) => {
          const count = pedidos.filter((p) => p.status === status).length
          const config = STATUS_CONFIG[status]
          const isActive = filtroStatus === status
          return (
            <button
              key={status}
              onClick={() => setFiltroStatus(isActive ? null : status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${isActive ? config.bgColor + ' ' + config.color + ' shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <config.icon className="w-3 h-3" />
              <span>{config.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${isActive ? 'bg-white/30' : 'bg-gray-100'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Info de filtro */}
      {(filtroStatus || filtroDataDe) && (
        <div className="mb-3 text-sm text-gray-500">
          {filtroStatus && <span>Filtrando por <strong>{STATUS_CONFIG[filtroStatus as PedidoStatus].label}</strong> — </span>}
          <span>{filtrados.length} pedido{filtrados.length !== 1 ? 's' : ''}</span>
          <button onClick={() => { setFiltroStatus(null); const hoje = new Date().toISOString().split('T')[0]; setFiltroDataDe(hoje); setFiltroDataAte(hoje) }} className="ml-2 text-blue-600 hover:underline">
            Limpar
          </button>
        </div>
      )}

      {/* Grid de Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtrados.length > 0 ? (
          filtrados.map((pedido) => {
            const config = STATUS_CONFIG[pedido.status]
            const StatusIcon = config.icon
            const nextStatus = NEXT_STATUS[pedido.status]
            const isNovo = pedido.status === 'novo'

            return (
              <div
                key={pedido.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all flex flex-col ${
                  isNovo ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* HEADER */}
                <div className={`p-3 border-b ${isNovo ? 'bg-orange-50/40' : 'bg-gray-50/40'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg font-bold text-gray-900">
                      {(pedido as any).codigo || ('#' + pedido.id.slice(0, 8))}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    🕐 {formatDate(pedido.data_criacao)} · {((pedido as any).tipo_entrega === 'retirada') ? '🏪 Retirada' : '🛵 Delivery'}
                  </p>
                </div>

                {/* CLIENTE + ENDEREÇO */}
                <div className="p-3 border-b border-gray-100 text-xs space-y-0.5">
                  <p className="font-semibold text-sm text-gray-900">{(pedido as any).cliente_nome || 'Cliente'}</p>
                  {(pedido as any).cliente_whatsapp && (
                    <p className="text-gray-600">📱 {(pedido as any).cliente_whatsapp}</p>
                  )}
                  {((pedido as any).tipo_entrega !== 'retirada') && (pedido as any).endereco_entrega && (
                    <p className="text-gray-600 truncate" title={(pedido as any).endereco_entrega + ', ' + ((pedido as any).numero_entrega || '') + ' - ' + ((pedido as any).bairro_entrega || '')}>
                      📍 {(pedido as any).endereco_entrega}, {(pedido as any).numero_entrega || 's/n'} - {(pedido as any).bairro_entrega || ''}
                    </p>
                  )}
                  {(pedido as any).observacoes && (
                    <p className="text-gray-500 italic truncate" title={(pedido as any).observacoes}>
                      💬 {(pedido as any).observacoes}
                    </p>
                  )}
                </div>

                {/* ITENS COMPACTOS */}
                <ItensPedido pedidoId={pedido.id} compacto />

                {/* Totais */}
                <div className="flex justify-between items-center text-sm mb-3 px-3">
                  <div className="text-gray-600">
                    <span className="text-xs">{formatFormaPagamento((pedido as any).forma_pagamento)}</span>
                    {pedido.valor_desconto > 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                        -{formatCurrency(pedido.valor_desconto)}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-green-600">{formatCurrency(pedido.valor_total)}</span>
                </div>

                {/* Avançar status */}
                {nextStatus && (
                  <button
                    onClick={() => onUpdateStatus(pedido, nextStatus)}
                    className="w-full px-4 py-3 mb-2 mx-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                  >
                    <ChevronRight className="w-5 h-5" />
                    AVANÇAR PARA {STATUS_CONFIG[nextStatus].label.toUpperCase()}
                  </button>
                )}

                {/* Botões de ação */}
                <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                  <button
                    onClick={() => onTogglePago(pedido)}
                    className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg text-xs transition-all ${
                      (pedido as any).pago ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{(pedido as any).pago ? '✓ Pago' : 'Pago'}</span>
                  </button>
                  <button
                    onClick={() => onAbrirModalEditar(pedido)}
                    className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => onImprimir(pedido)}
                    className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>
                  <button
                    onClick={() => onConfirmarWPP(pedido)}
                    className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => onAbrirModalDesconto(pedido)}
                    className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs transition-all"
                  >
                    <Percent className="w-4 h-4" />
                    <span>Desconto</span>
                  </button>
                  <button
                    onClick={() => onAbrirModalCancelamento(pedido)}
                    className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs transition-all"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-full bg-white rounded-xl border p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido em fluxo</h3>
            <p className="hint">Pedidos em andamento aparecerão aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}
