'use client'

import { memo } from 'react'
import {
  Clock, Check, Truck, X, ChevronRight, MessageCircle, Pencil, Printer,
  Percent, Trash2, Star, MapPin, Home, Bike, AlertTriangle
} from 'lucide-react'
import { PedidoStatus } from '@/types'
import { formatCurrency, formatarCodigoPedido } from '@/lib/utils'
import { parseComplements, savedItemTotal } from '@/lib/product-pricing'

interface PedidoCardProps {
  pedido: any
  itensCache: Record<string, any[]>
  config: any
  nextStatus: PedidoStatus | null
  onUpdateStatus: (pedido: any, newStatus: PedidoStatus) => void
  onTogglePago: (pedido: any) => void
  onEditar: (pedido: any) => void
  onConfirmarWPP: (pedido: any) => void
  onImprimir: (pedido: any) => void
  onDesconto: (pedido: any) => void
  onCancelar: (pedido: any) => void
  onApagar: (pedido: any) => void
  onGerarAvaliacao: (pedidoId: string) => void
}

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; bgColor: string; icon: any }> = {
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

export const PedidoCard = memo(function PedidoCard({
  pedido,
  itensCache,
  config,
  nextStatus,
  onUpdateStatus,
  onTogglePago,
  onEditar,
  onConfirmarWPP,
  onImprimir,
  onDesconto,
  onCancelar,
  onApagar,
  onGerarAvaliacao,
}: PedidoCardProps) {
  const statusConfig = STATUS_CONFIG[pedido.status]
  const StatusIcon = statusConfig.icon
  const isNovo = pedido.status === 'novo'
  const isCancelado = pedido.status === 'cancelado'
  const isEntregue = pedido.status === 'entregue'

  const itensDoCard = itensCache[pedido.id] || []
  const totalItens = itensDoCard.reduce((acc: number, i: any) => acc + (Number(i.quantidade) || 1), 0)

  return (
    <div
      className={`order-card-redesign bg-white rounded-[18px] border overflow-hidden flex flex-col transition-all shadow-sm ${
        isNovo ? 'ring-2 ring-orange-300' : ''
      }`}
      style={{ borderColor: '#E4E8EE' }}
    >
      {/* HEADER */}
      <div className="px-4 py-4 border-b" style={{ borderColor: '#E4E8EE' }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="text-[22px] font-medium tracking-tight" style={{ color: '#172033' }}>
            Pedido {formatarCodigoPedido(pedido.id, pedido.data_criacao, pedido.codigo)}
          </h2>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: isCancelado ? '#FFF1F1' : isEntregue ? '#EEFAF3' : '#FFF7E8',
                color: isCancelado ? '#D92D35' : isEntregue ? '#00A240' : '#B55C00',
              }}
            >
              <StatusIcon size={12} />
              {statusConfig.label}
            </span>
            {isEntregue && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onGerarAvaliacao(pedido.id) }}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition"
                style={{ background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A' }}
                title="Copiar link de avaliação"
              >
                <Star size={10} />
                Avaliação
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: '#697386' }}>
          <Clock size={12} />
          <span>{new Date(pedido.data_criacao).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          })}</span>
        </div>
      </div>

      {/* CLIENTE + ENDEREÇO */}
      <div className="mx-3 mt-3 p-4 rounded-[18px]" style={{ background: '#F8FAFC' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="size-10 rounded-full grid place-items-center font-medium text-sm shrink-0"
            style={{ background: '#EEFAF3', color: '#00A240' }}
          >
            {(pedido.cliente_nome || 'C').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[15px]" style={{ color: '#172033' }}>
              {pedido.cliente_nome || 'Cliente'}
            </p>
            {pedido.cliente_whatsapp && (
              <p className="text-xs mt-0.5" style={{ color: '#697386' }}>
                {pedido.cliente_whatsapp}
              </p>
            )}
          </div>
        </div>
        {pedido.tipo_entrega !== 'retirada' && pedido.endereco_entrega && (
          <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid #E4E8EE' }}>
            <p className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: '#172033' }}>
              <MapPin size={12} className="mt-0.5 shrink-0" style={{ color: '#697386' }} />
              <span>
                {pedido.endereco_entrega}
                {pedido.numero_entrega ? `, ${pedido.numero_entrega}` : ''}
                {pedido.bairro_entrega ? ` — ${pedido.bairro_entrega}` : ''}
              </span>
            </p>
            {pedido.complemento_entrega && (
              <p className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: '#697386' }}>
                <Home size={12} className="mt-0.5 shrink-0" />
                <span>Complemento: {pedido.complemento_entrega}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ITENS DO PEDIDO */}
      <div className="mx-3 mt-2 p-4 rounded-[18px]" style={{ background: '#F8FAFC' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm" style={{ color: '#172033' }}>Itens do pedido</h3>
          <span className="text-xs" style={{ color: '#697386' }}>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
        </div>
        {itensDoCard.length === 0 ? (
          <p className="text-xs" style={{ color: '#697386' }}>Carregando...</p>
        ) : (
          <div className="space-y-3">
            {itensDoCard.map((item: any) => {
              const comps = parseComplements(item.complementos)
              return (
                <div key={item.id}>
                  <div className="flex justify-between gap-3 text-[14px] font-medium" style={{ color: '#172033' }}>
                    <span className="truncate">{item.quantidade}× {item.nome}</span>
                    <span className="whitespace-nowrap">{formatCurrency(savedItemTotal(item))}</span>
                  </div>
                  {comps.length > 0 && (
                    <div className="mt-2 pl-2.5 border-l-2 space-y-1.5" style={{ borderColor: '#E4E8EE' }}>
                      {comps.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between gap-3 text-xs" style={{ color: '#697386' }}>
                          <span className="truncate">
                            {c.tipo === 'sabor' ? c.nome : `${c.quantidade > 1 ? `${c.quantidade}x ` : ''}${c.nome}`}
                          </span>
                          <span className="whitespace-nowrap">{formatCurrency((c.valor || 0) * (c.quantidade || 1))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ENTREGA / TAXA */}
        {pedido.tipo_entrega === 'retirada' ? (
          <div
            className="mt-3 px-3 py-2.5 rounded-xl flex items-center justify-between text-[13px] font-medium"
            style={{ background: '#F1F5F9', color: '#475569' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Home size={12} /> Retirada no balcão
            </span>
            <span>Sem taxa</span>
          </div>
        ) : (
          pedido.taxa_entrega > 0 && (
            <div
              className="mt-3 px-3 py-2.5 rounded-xl flex items-center justify-between text-[13px] font-medium"
              style={{ background: '#FEF3C7', color: '#92400E' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Bike size={12} /> Entrega (taxa)
              </span>
              <span>+ {formatCurrency(pedido.taxa_entrega)}</span>
            </div>
          )
        )}

        {/* DESCONTO */}
        {pedido.valor_desconto > 0 && (
          <div
            className="mt-4 px-3 py-2.5 rounded-xl flex items-center justify-between text-[13px] font-medium"
            style={{ background: '#EEFAF3', color: '#00A240' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Percent size={12} /> Desconto concedido
            </span>
            <span>− {formatCurrency(pedido.valor_desconto)}</span>
          </div>
        )}
      </div>

      {/* OBS */}
      {pedido.observacoes && (
        <div className="mx-3 mt-2 p-3 rounded-xl text-xs" style={{ background: '#FFF7E8', color: '#B55C00' }}>
          📝 {pedido.observacoes}
        </div>
      )}

      {/* PAGAMENTO + AÇÕES */}
      <div className="mt-2 mx-3 mb-3 p-4 rounded-[18px]" style={{ background: '#F8FAFC' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs" style={{ color: '#697386' }}>Forma de pagamento</p>
            <p className="text-[14px] font-medium capitalize" style={{ color: '#172033' }}>
              {pedido.forma_pagamento}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#697386' }}>Total do pedido</p>
            <p className="text-[21px] font-medium" style={{ color: '#00A240' }}>
              {formatCurrency(pedido.valor_total)}
            </p>
          </div>
        </div>

        {/* LINHA 1: Avançar status (quando aplicável) */}
        {nextStatus && (
          <button
            onClick={() => onUpdateStatus(pedido, nextStatus)}
            className="w-full min-h-[43px] mb-2 flex items-center justify-center gap-2 rounded-xl text-[12px] font-medium transition-all active:scale-[0.98]"
            style={{ background: '#00A240', color: '#FFFFFF' }}
            title={`Avançar para ${STATUS_CONFIG[nextStatus].label}`}
          >
            <ChevronRight size={16} />
            AVANÇAR PARA {STATUS_CONFIG[nextStatus].label.toUpperCase()}
          </button>
        )}

        {/* LINHA 2: Grid 2x3 ações */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          {/* Pago */}
          <button
            onClick={() => onTogglePago(pedido)}
            className="min-h-[43px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition"
            style={{
              background: pedido.pago ? '#00A240' : '#FFFFFF',
              color: pedido.pago ? '#FFFFFF' : '#172033',
              border: pedido.pago ? 'none' : '1px solid #E4E8EE',
            }}
            title={pedido.pago ? 'Pago - clique para desmarcar' : 'Marcar como pago'}
          >
            <Check size={14} /> {pedido.pago ? 'Pago' : 'Marcar pago'}
          </button>

          {/* Editar */}
          <button
            onClick={() => onEditar(pedido)}
            className="min-h-[43px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition"
            style={{ background: '#FFFFFF', color: '#172033', border: '1px solid #E4E8EE' }}
            title="Editar pedido"
          >
            <Pencil size={14} /> Editar
          </button>

          {/* WhatsApp */}
          <button
            onClick={() => onConfirmarWPP(pedido)}
            className="min-h-[43px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition"
            style={{ background: '#EEFAF3', color: '#00A240' }}
            title="Confirmar pedido (WhatsApp)"
          >
            <MessageCircle size={14} /> WhatsApp
          </button>

          {/* Imprimir */}
          <button
            onClick={() => onImprimir(pedido)}
            className="min-h-[43px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition"
            style={{ background: '#FFFFFF', color: '#172033', border: '1px solid #E4E8EE' }}
            title="Imprimir pedido"
          >
            <Printer size={14} /> Imprimir
          </button>

          {/* Desconto */}
          <button
            onClick={() => onDesconto(pedido)}
            className="min-h-[43px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition"
            style={{ background: '#FFF7E8', color: '#B55C00' }}
            title="Dar desconto"
          >
            <Percent size={14} /> Desconto
          </button>

          {/* Cancelar ou Apagar */}
          {isCancelado ? (
            <button
              onClick={() => onApagar(pedido)}
              className="min-h-[43px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition"
              style={{ background: '#FFF1F1', color: '#D92D35' }}
              title="Apagar pedido (somente cancelados)"
            >
              <Trash2 size={14} /> Apagar
            </button>
          ) : (
            <button
              onClick={() => onCancelar(pedido)}
              className="min-h-[43px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition"
              style={{ background: '#FFF1F1', color: '#D92D35' }}
              title="Cancelar pedido"
            >
              <X size={14} /> Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
