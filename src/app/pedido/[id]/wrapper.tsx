'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Check, Truck, X, MapPin, Phone, User, Loader2, Package, ChefHat, Bike, Home } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  codigo: string
  tenantNome: string
  tenantSlug: string
  tenantTelefone: string
  tenantLogo: string | null
  pedidoId: string
  initialStatus: string
  initialData: any
}

const STATUS_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  novo: { label: 'Pedido Recebido', icon: Package, color: 'bg-orange-500' },
  preparando: { label: 'Em Preparo', icon: ChefHat, color: 'bg-yellow-500' },
  pronto: { label: 'Pronto', icon: Check, color: 'bg-green-500' },
  saiu: { label: 'Saiu para Entrega', icon: Bike, color: 'bg-blue-500' },
  entregue: { label: 'Entregue', icon: Home, color: 'bg-green-600' },
  cancelado: { label: 'Cancelado', icon: X, color: 'bg-red-500' },
}

export default function PedidoClienteWrapper({
  codigo,
  tenantNome,
  tenantSlug,
  tenantTelefone,
  tenantLogo,
  pedidoId,
  initialStatus,
  initialData,
}: Props) {
  const [pedido, setPedido] = useState(initialData)
  const supabase = createClient()

  useEffect(() => {
    // Inscrever no realtime para receber atualizacoes
    const channel = supabase
      .channel('pedido-cliente')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `id=eq.${pedidoId}`,
        },
        (payload) => {
          setPedido((prev: any) => ({ ...prev, ...payload.new }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pedidoId])

  const status = pedido.status || initialStatus
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.novo
  const StatusIcon = statusInfo.icon

  // Ordem dos status
  const ordem = ['novo', 'preparando', 'pronto', 'saiu', 'entregue']
  const indexAtual = ordem.indexOf(status)
  const isCancelado = status === 'cancelado'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {tenantLogo && <img src={tenantLogo} alt={tenantNome} className="w-10 h-10 rounded-full object-cover" />}
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">{tenantNome}</h1>
            <p className="text-xs text-gray-500">Acompanhamento do pedido</p>
          </div>
          <a
            href={`/${tenantSlug}`}
            className="text-sm text-green-600 font-medium"
          >
            Voltar ao cardápio
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header do pedido */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`size-12 rounded-xl ${statusInfo.color} flex items-center justify-center text-white`}>
              <StatusIcon size={24} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Pedido</p>
              <p className="text-2xl font-bold text-gray-900">{codigo}</p>
            </div>
          </div>
          <div className={`p-4 rounded-xl ${isCancelado ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className={`font-semibold text-lg ${isCancelado ? 'text-red-700' : 'text-green-700'}`}>
              {statusInfo.label}
            </p>
            {!isCancelado && (
              <p className="text-sm text-gray-600 mt-1">
                {indexAtual === 0 && 'Aguardando confirmação da loja...'}
                {indexAtual === 1 && 'Seu pedido está sendo preparado com carinho'}
                {indexAtual === 2 && 'Pedido pronto! Em breve sai para entrega'}
                {indexAtual === 3 && 'Saiu! Está a caminho'}
                {indexAtual === 4 && 'Pedido entregue! Bom apetite 🎉'}
              </p>
            )}
          </div>
        </div>

        {/* Timeline de status */}
        {!isCancelado && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Status do Pedido</h2>
            <div className="space-y-4">
              {ordem.map((s, idx) => {
                const config = STATUS_LABELS[s]
                const Icon = config.icon
                const completed = idx <= indexAtual
                const current = idx === indexAtual
                return (
                  <div key={s} className="flex items-start gap-3">
                    <div className={`size-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      completed ? `${config.color} text-white` : 'bg-gray-200 text-gray-400'
                    } ${current ? 'ring-4 ring-green-200 animate-pulse' : ''}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className={`font-medium ${completed ? 'text-gray-900' : 'text-gray-400'}`}>
                        {config.label}
                      </p>
                      {current && (
                        <p className="text-xs text-green-600 font-medium">Em andamento</p>
                      )}
                      {completed && !current && (
                        <p className="text-xs text-gray-500">✓ Concluído</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Itens do pedido */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Itens do Pedido</h2>
          <div className="space-y-3">
            {(pedido.pedido_itens || []).map((item: any) => {
              const comps = Array.isArray(item.complementos)
                ? (typeof item.complementos === 'string' ? JSON.parse(item.complementos) : item.complementos)
                : []
              return (
                <div key={item.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{item.quantidade}x {item.nome}</p>
                      {item.variante_nome && (
                        <p className="text-xs text-gray-500">({item.variante_nome})</p>
                      )}
                    </div>
                    <p className="font-semibold">
                      {formatCurrency(Number(item.valor_unitario) * item.quantidade)}
                    </p>
                  </div>
                  {comps.length > 0 && (
                    <div className="ml-2 mt-1 space-y-0.5">
                      {comps.map((c: any, i: number) => (
                        <p key={i} className="text-xs text-gray-500">
                          • {c.quantidade > 1 ? `${c.quantidade}x ` : ''}{c.nome}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Totais */}
          <div className="mt-4 pt-4 border-t space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(Number(pedido.valor_subtotal || pedido.valor_total) - Number(pedido.taxa_entrega || 0))}</span>
            </div>
            {Number(pedido.taxa_entrega) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Taxa de entrega:</span>
                <span>{formatCurrency(Number(pedido.taxa_entrega))}</span>
              </div>
            )}
            {Number(pedido.valor_desconto) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto:</span>
                <span>-{formatCurrency(Number(pedido.valor_desconto))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>TOTAL:</span>
              <span className="text-green-600">{formatCurrency(Number(pedido.valor_total))}</span>
            </div>
          </div>
        </div>

        {/* Entrega */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">
            {pedido.tipo_entrega === 'retirada' ? '🏪 Retirada' : '🛵 Entrega'}
          </h2>
          {pedido.tipo_entrega === 'retirada' ? (
            <p className="text-sm text-gray-600">Você vai retirar no local</p>
          ) : (
            <>
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={16} className="text-gray-400 mt-0.5" />
                <p className="text-gray-900">
                  {pedido.endereco_entrega}, {pedido.numero_entrega || 's/n'}
                  {pedido.complemento_entrega && ` (${pedido.complemento_entrega})`}
                </p>
              </div>
              {pedido.bairro_entrega && (
                <p className="ml-6 text-sm text-gray-600">Bairro: {pedido.bairro_entrega}</p>
              )}
            </>
          )}
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">💳 Pagamento</h2>
          <p className="text-sm text-gray-600">
            {Array.isArray(pedido.forma_pagamento)
              ? pedido.forma_pagamento.join(', ')
              : pedido.forma_pagamento}
          </p>
          {pedido.observacoes && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg">
              <p className="text-xs font-medium text-amber-700">Observações:</p>
              <p className="text-sm text-amber-800">{pedido.observacoes}</p>
            </div>
          )}
        </div>

        {/* Contato */}
        {tenantTelefone && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">📞 Contato da Loja</h2>
            <a
              href={`https://wa.me/55${tenantTelefone.replace(/\D/g, '')}`}
              target="_blank"
              className="flex items-center gap-2 text-green-600 font-medium"
            >
              <Phone size={16} />
              Falar com a loja via WhatsApp
            </a>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pt-4">
          🔄 Atualização em tempo real
        </p>
      </div>
    </div>
  )
}
