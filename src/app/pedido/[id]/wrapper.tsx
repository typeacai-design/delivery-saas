'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChefHat, Check, Bike, Home, MapPin, Receipt, MessageCircle, ChevronLeft, MoreHorizontal, Package, X as XIcon } from 'lucide-react'
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
  // Cores personalizadas do lojista (cardapio_cores)
  customColors?: { primary?: string; secondary?: string; accent?: string }
  // Tipografia escolhida
  tipografia?: string
}

const STATUS_CONFIG: Record<string, {
  label: string
  descricao: string
  icon: any
  previsaoMin: number
  previsaoMax: number
}> = {
  novo: {
    label: 'Aguardando confirmação',
    descricao: 'Seu pedido foi recebido e está aguardando a loja confirmar.',
    icon: Package,
    previsaoMin: 5,
    previsaoMax: 10,
  },
  preparando: {
    label: 'Seu pedido está sendo preparado',
    descricao: 'A cozinha já começou a preparar tudo com cuidado.',
    icon: ChefHat,
    previsaoMin: 20,
    previsaoMax: 30,
  },
  pronto: {
    label: 'Pedido pronto',
    descricao: 'Tudo pronto! Em breve sai para entrega.',
    icon: Check,
    previsaoMin: 5,
    previsaoMax: 10,
  },
  saiu: {
    label: 'Saiu para entrega',
    descricao: 'Seu pedido está a caminho!',
    icon: Bike,
    previsaoMin: 10,
    previsaoMax: 25,
  },
  entregue: {
    label: 'Pedido entregue',
    descricao: 'Pedido entregue! Bom apetite 🎉',
    icon: Home,
    previsaoMin: 0,
    previsaoMax: 0,
  },
  cancelado: {
    label: 'Pedido cancelado',
    descricao: 'Este pedido foi cancelado.',
    icon: XIcon,
    previsaoMin: 0,
    previsaoMax: 0,
  },
}

const ETAPAS = ['preparando', 'pronto', 'saiu', 'entregue'] as const

// Converte hex pra HSL — usado para ajustar o accent
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function isDark(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false
  const { l } = hexToHsl(hex)
  return l < 50
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
  customColors,
  tipografia,
}: Props) {
  const [pedido, setPedido] = useState(initialData)
  const supabase = createClient()

  // Resolve cores a partir do que o lojista configurou no Design
  const palette = useMemo(() => {
    const primary = customColors?.primary || '#16A34A'
    const secondary = customColors?.secondary || '#15803D'
    const accent = customColors?.accent || primary
    return { primary, secondary, accent }
  }, [customColors?.primary, customColors?.secondary, customColors?.accent])

  // Font family baseado na tipografia escolhida
  const fontFamily = useMemo(() => {
    const map: Record<string, string> = {
      classica: 'inherit',
      moderna: '"Inter", system-ui, sans-serif',
      minimalista: '"Syne", system-ui, sans-serif',
    }
    return map[tipografia || 'classica']
  }, [tipografia])

  useEffect(() => {
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
  }, [pedidoId, supabase])

  const status = pedido.status || initialStatus
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.novo
  const StatusIcon = statusInfo.icon
  const isCancelado = status === 'cancelado'

  // Calcula etapa atual na timeline
  const etapaAtualIndex = ETAPAS.indexOf(status as any)
  const isCompleto = status === 'entregue'

  // Monta endereço completo
  const enderecoCompleto = pedido.endereco_entrega
    ? [
        pedido.endereco_entrega,
        pedido.numero_entrega ? `, ${pedido.numero_entrega}` : '',
        pedido.complemento_entrega ? ` (${pedido.complemento_entrega})` : '',
      ].join('')
    : pedido.bairro_entrega || ''

  // Quantidade de itens
  const totalItens = (pedido.pedido_itens || []).reduce((sum: number, i: any) => sum + (Number(i.quantidade) || 1), 0)

  // Cor da timeline baseada na paleta
  const activeColor = isCancelado ? '#DC2626' : palette.primary
  const activeBg = isCancelado ? '#DC2626' : palette.primary
  const inactiveColor = '#6B7280'

  // Estilo do header (dark com accent do lojista)
  const accentBg = isDark(palette.accent) ? palette.accent : palette.secondary
  const accentText = '#FFFFFF'

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC', fontFamily }}>
      {/* ===================== HEADER ===================== */}
      <div
        className="sticky top-0 z-20 px-4 py-4 flex items-center justify-between"
        style={{ background: accentBg, color: accentText }}
      >
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = `/${tenantSlug}`}
          className="size-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-bold text-base">Acompanhar pedido</h1>
          <p className="text-xs opacity-90">Pedido #{codigo}</p>
        </div>
        <button
          className="size-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          aria-label="Mais opções"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-3">
        {/* ===================== CARD PRINCIPAL — STATUS ATUAL ===================== */}
        <div
          className="rounded-3xl p-6 text-center shadow-sm"
          style={{ background: '#FFFFFF' }}
        >
          <div
            className="size-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{
              background: isCancelado ? '#FEE2E2' : `${palette.primary}22`,
              color: isCancelado ? '#DC2626' : palette.primary,
            }}
          >
            <StatusIcon size={28} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#111827' }}>
            {statusInfo.label}
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            {statusInfo.descricao}
          </p>
          {!isCancelado && !isCompleto && (
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                background: `${palette.primary}22`,
                color: palette.primary,
              }}
            >
              <span>⏱</span>
              <span>Previsão: {statusInfo.previsaoMin}-{statusInfo.previsaoMax} min</span>
            </div>
          )}
        </div>

        {/* ===================== TIMELINE HORIZONTAL ===================== */}
        {!isCancelado && (
          <div
            className="rounded-3xl p-6 shadow-sm"
            style={{ background: '#FFFFFF' }}
          >
            <div className="flex items-center justify-between">
              {ETAPAS.map((etapa, idx) => {
                const config = STATUS_CONFIG[etapa]
                const Icon = config.icon
                const completada = idx <= etapaAtualIndex
                const atual = idx === etapaAtualIndex
                return (
                  <div key={etapa} className="flex-1 flex flex-col items-center relative">
                    {/* Linha conectora (entre etapas) */}
                    {idx < ETAPAS.length - 1 && (
                      <div
                        className="absolute top-5 left-1/2 w-full h-0.5"
                        style={{
                          background: idx < etapaAtualIndex ? activeBg : '#E5E7EB',
                          zIndex: 0,
                        }}
                      />
                    )}
                    <div
                      className="size-10 rounded-full flex items-center justify-center relative z-10 transition-all"
                      style={{
                        background: completada ? activeBg : '#FFFFFF',
                        border: completada ? 'none' : '2px solid #E5E7EB',
                        color: completada ? '#FFFFFF' : inactiveColor,
                        boxShadow: atual ? `0 0 0 4px ${palette.primary}33` : 'none',
                      }}
                    >
                      {completada ? <Check size={18} strokeWidth={3} /> : <Icon size={16} />}
                    </div>
                    <p
                      className={`mt-2 text-xs font-medium text-center ${atual ? 'font-bold' : ''}`}
                      style={{ color: atual ? palette.primary : completada ? '#111827' : '#9CA3AF' }}
                    >
                      {config.label.replace('Seu pedido está sendo ', '').replace('Pedido ', '')}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===================== ENDEREÇO DE ENTREGA ===================== */}
        <button
          className="w-full rounded-3xl p-4 shadow-sm flex items-center gap-3 hover:opacity-80 transition"
          style={{ background: '#FFFFFF' }}
        >
          <div
            className="size-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${palette.primary}22`, color: palette.primary }}
          >
            <MapPin size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-sm" style={{ color: '#111827' }}>
              Endereço de entrega
            </p>
            <p className="text-xs text-gray-500 truncate">
              {pedido.tipo_entrega === 'retirada' ? 'Retirada no local' : (enderecoCompleto || '—')}
            </p>
          </div>
          <span className="text-gray-400">›</span>
        </button>

        {/* ===================== RESUMO DO PEDIDO ===================== */}
        <button
          className="w-full rounded-3xl p-4 shadow-sm flex items-center gap-3 hover:opacity-80 transition"
          style={{ background: '#FFFFFF' }}
        >
          <div
            className="size-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${palette.primary}22`, color: palette.primary }}
          >
            <Receipt size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-sm" style={{ color: '#111827' }}>
              Resumo do pedido
            </p>
            <p className="text-xs text-gray-500">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'} · Total {formatCurrency(Number(pedido.valor_total) || 0)}
            </p>
          </div>
          <span className="text-gray-400">›</span>
        </button>

        {/* ===================== DETALHES EXPANDIDOS (lista de itens) ===================== */}
        <details
          className="rounded-3xl shadow-sm overflow-hidden"
          style={{ background: '#FFFFFF' }}
        >
          <summary className="p-4 cursor-pointer font-semibold text-sm flex items-center justify-between" style={{ color: '#111827' }}>
            <span>Ver itens do pedido</span>
            <span className="text-gray-400">›</span>
          </summary>
          <div className="px-4 pb-4 space-y-3 border-t pt-3">
            {(pedido.pedido_itens || []).map((item: any) => {
              const comps = Array.isArray(item.complementos)
                ? (typeof item.complementos === 'string' ? JSON.parse(item.complementos) : item.complementos)
                : []
              return (
                <div key={item.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.quantidade}x {item.nome}</p>
                      {item.variante_nome && (
                        <p className="text-xs text-gray-500">({item.variante_nome})</p>
                      )}
                    </div>
                    <p className="font-semibold text-sm">
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

            {/* Totais */}
            <div className="pt-3 border-t space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(Number(pedido.valor_subtotal || pedido.valor_total || 0))}</span>
              </div>
              {Number(pedido.taxa_entrega) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Taxa de entrega:</span>
                  <span>{formatCurrency(Number(pedido.taxa_entrega))}</span>
                </div>
              )}
              {Number(pedido.valor_desconto) > 0 && (
                <div className="flex justify-between" style={{ color: palette.primary }}>
                  <span>Desconto:</span>
                  <span>-{formatCurrency(Number(pedido.valor_desconto))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>TOTAL:</span>
                <span style={{ color: palette.primary }}>{formatCurrency(Number(pedido.valor_total) || 0)}</span>
              </div>
            </div>

            {/* Forma de pagamento */}
            {pedido.forma_pagamento && (
              <div className="pt-3 border-t text-xs text-gray-500">
                💳 Pagamento: {pedido.forma_pagamento}
              </div>
            )}
          </div>
        </details>

        {/* ===================== BOTÃO FALAR COM A LOJA ===================== */}
        {tenantTelefone && !isCancelado && (
          <a
            href={`https://wa.me/55${tenantTelefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Estou acompanhando o pedido #${codigo}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full py-4 flex items-center justify-center gap-2 font-semibold text-sm shadow-md hover:opacity-90 transition"
            style={{
              background: '#FFFFFF',
              color: '#111827',
              border: '1px solid #E5E7EB',
            }}
          >
            <MessageCircle size={18} />
            Falar com o estabelecimento
          </a>
        )}

        <p className="text-center text-xs text-gray-400 pt-2">
          🔄 Atualização em tempo real
        </p>
      </div>
    </div>
  )
}
