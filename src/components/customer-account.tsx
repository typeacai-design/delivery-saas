'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChefHat, Check, Bike, Home, MapPin, Receipt, MessageCircle, Package, X as XIcon, ChevronRight, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Customer = Record<string, string | undefined> & { whatsapp?: string; accessToken?: string }
type OrderItem = { nome: string; quantidade: number; variante_nome?: string | null }
type Order = {
  id: string
  status: string
  created_at: string
  valor_total: number
  pedido_itens?: OrderItem[]
  endereco_entrega?: string
  numero_entrega?: string
  bairro_entrega?: string
  complemento_entrega?: string
  tipo_entrega?: string
  forma_pagamento?: string | string[]
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

const customerKey = (slug: string) => `delivery_cliente_dados_${slug}`

function formatDate(value: string | undefined) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function validDate(value: string | undefined) {
  if (!value) return true
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return false
  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  const date = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso && date <= new Date()
}

function isoDate(value: string | undefined) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '')
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

function validCpf(value: string | undefined) {
  const cpf = (value || '').replace(/\D/g, '')
  if (!cpf) return true
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (size: number) => { let sum = 0; for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i); const result = (sum * 10) % 11; return result === 10 ? 0 : result }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

// Hook para buscar cores e tipografia do lojista (paleta dinâmica)
function useTenantTheme(slug: string) {
  const [theme, setTheme] = useState<{
    primary: string
    secondary: string
    accent: string
    tipografia: string
    telefone: string
    whatsapp: string
    loaded: boolean
  }>({
    primary: '#16A34A',
    secondary: '#15803D',
    accent: '#16A34A',
    tipografia: 'classica',
    telefone: '',
    whatsapp: '',
    loaded: false,
  })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/cardapio/design?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.tenant) return
        const cfg = (data.tenant.config || {}) as any
        const colors = cfg.cardapio_cores || {}
        setTheme({
          primary: colors.primary || data.tenant.cor_principal || '#16A34A',
          secondary: colors.secondary || '#15803D',
          accent: colors.accent || colors.primary || data.tenant.cor_principal || '#16A34A',
          tipografia: cfg.cardapio_tipografia || 'classica',
          telefone: data.tenant.telefone || '',
          whatsapp: cfg.cardapio_whatsapp_numero || data.tenant.telefone || '',
          loaded: true,
        })
      })
      .catch(() => {
        if (!cancelled) setTheme(prev => ({ ...prev, loaded: true }))
      })
    return () => { cancelled = true }
  }, [slug])

  return theme
}

// Helper para verificar se uma cor é escura
function isDark(hex: string): boolean {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return false
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
  return l < 0.5
}

export function CustomerOrders({ slug, cliente }: { slug: string; cliente: Customer }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [message, setMessage] = useState(cliente.whatsapp && cliente.accessToken ? 'Carregando…' : 'Finalize seu primeiro pedido neste aparelho para acompanhar o histórico.')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const theme = useTenantTheme(slug)
  const supabase = createClient()

  const fontFamily = useMemo(() => {
    const map: Record<string, string> = {
      classica: 'inherit',
      moderna: '"Inter", system-ui, sans-serif',
      minimalista: '"Syne", system-ui, sans-serif',
    }
    return map[theme.tipografia]
  }, [theme.tipografia])

  useEffect(() => {
    if (!cliente.whatsapp || !cliente.accessToken) return
    const query = new URLSearchParams({ tenant_slug: slug })
    const load = () => fetch(`/api/pedidos/public?${query}`, {
      headers: { Authorization: `Bearer ${cliente.accessToken}` }, cache: 'no-store',
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setOrders(body.pedidos || []); setMessage('')
    }).catch(() => setMessage('Não foi possível consultar seus pedidos.'))
    load(); const timer = window.setInterval(load, 15_000) // 15s para atualização mais rápida
    return () => window.clearInterval(timer)
  }, [slug, cliente.whatsapp, cliente.accessToken])

  // Realtime: atualiza automaticamente quando lojista muda status
  useEffect(() => {
    if (!orders.length || !supabase) return
    const channel = supabase
      .channel('customer-orders-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orders.length, supabase])

  const isDarkPrimary = isDark(theme.primary)
  const activeBg = theme.primary
  const inactiveColor = '#9CA3AF'

  // ============ VISUALIZAÇÃO DE UM PEDIDO (LAYOUT DARK) ============
  if (selectedOrder) {
    const order = orders.find(o => o.id === selectedOrder.id) || selectedOrder
    const status = order.status
    const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.novo
    const StatusIcon = statusInfo.icon
    const isCancelado = status === 'cancelado'
    const etapaAtualIndex = ETAPAS.indexOf(status as any)
    const isCompleto = status === 'entregue'

    const enderecoCompleto = order.endereco_entrega
      ? [
          order.endereco_entrega,
          order.numero_entrega ? `, ${order.numero_entrega}` : '',
          order.complemento_entrega ? ` (${order.complemento_entrega})` : '',
        ].join('')
      : order.bairro_entrega || ''

    const totalItens = (order.pedido_itens || []).reduce((sum: number, i: any) => sum + (Number(i.quantidade) || 1), 0)

    return (
      <div className="min-h-screen pb-24" style={{ background: '#F8FAFC', fontFamily }}>
        {/* Header dark com cor accent do lojista */}
        <div
          className="sticky top-0 z-20 px-4 py-4 flex items-center justify-between"
          style={{ background: isDarkPrimary ? theme.primary : theme.secondary, color: '#FFFFFF' }}
        >
          <button
            onClick={() => setSelectedOrder(null)}
            className="size-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.18)' }}
            aria-label="Voltar"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="font-bold text-base">Acompanhar pedido</h1>
            <p className="text-xs opacity-90">Pedido #{order.id.slice(0, 8)}</p>
          </div>
          <div className="size-10" />
        </div>

        <div className="max-w-md mx-auto px-4 py-4 space-y-3">
          {/* CARD PRINCIPAL — STATUS ATUAL */}
          <div className="rounded-3xl p-6 text-center shadow-sm" style={{ background: '#FFFFFF' }}>
            <div
              className="size-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{
                background: isCancelado ? '#FEE2E2' : `${theme.primary}22`,
                color: isCancelado ? '#DC2626' : theme.primary,
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
                  background: `${theme.primary}22`,
                  color: theme.primary,
                }}
              >
                <span>⏱</span>
                <span>Previsão: {statusInfo.previsaoMin}-{statusInfo.previsaoMax} min</span>
              </div>
            )}
          </div>

          {/* TIMELINE HORIZONTAL */}
          {!isCancelado && (
            <div className="rounded-3xl p-6 shadow-sm" style={{ background: '#FFFFFF' }}>
              <div className="flex items-center justify-between">
                {ETAPAS.map((etapa, idx) => {
                  const config = STATUS_CONFIG[etapa]
                  const Icon = config.icon
                  const completada = idx <= etapaAtualIndex
                  const atual = idx === etapaAtualIndex
                  return (
                    <div key={etapa} className="flex-1 flex flex-col items-center relative">
                      {idx < ETAPAS.length - 1 && (
                        <div
                          className="absolute top-5 left-1/2 w-full h-0.5"
                          style={{ background: idx < etapaAtualIndex ? activeBg : '#E5E7EB', zIndex: 0 }}
                        />
                      )}
                      <div
                        className="size-10 rounded-full flex items-center justify-center relative z-10"
                        style={{
                          background: completada ? activeBg : '#FFFFFF',
                          border: completada ? 'none' : '2px solid #E5E7EB',
                          color: completada ? '#FFFFFF' : inactiveColor,
                          boxShadow: atual ? `0 0 0 4px ${theme.primary}33` : 'none',
                        }}
                      >
                        {completada ? <Check size={18} strokeWidth={3} /> : <Icon size={16} />}
                      </div>
                      <p
                        className={`mt-2 text-xs font-medium text-center ${atual ? 'font-bold' : ''}`}
                        style={{ color: atual ? theme.primary : completada ? '#111827' : '#9CA3AF' }}
                      >
                        {config.label.replace('Seu pedido está sendo ', '').replace('Pedido ', '')}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ENDEREÇO */}
          <div
            className="w-full rounded-3xl p-4 shadow-sm flex items-center gap-3"
            style={{ background: '#FFFFFF' }}
          >
            <div
              className="size-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${theme.primary}22`, color: theme.primary }}
            >
              <MapPin size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm" style={{ color: '#111827' }}>Endereço de entrega</p>
              <p className="text-xs text-gray-500 truncate">
                {order.tipo_entrega === 'retirada' ? 'Retirada no local' : (enderecoCompleto || '—')}
              </p>
            </div>
          </div>

          {/* RESUMO DO PEDIDO */}
          <details
            className="rounded-3xl shadow-sm overflow-hidden"
            style={{ background: '#FFFFFF' }}
          >
            <summary className="p-4 cursor-pointer font-semibold text-sm flex items-center gap-3" style={{ color: '#111827' }}>
              <div
                className="size-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${theme.primary}22`, color: theme.primary }}
              >
                <Receipt size={20} />
              </div>
              <div className="flex-1 text-left">
                <p>Resumo do pedido</p>
                <p className="text-xs text-gray-500 font-normal">
                  {totalItens} {totalItens === 1 ? 'item' : 'itens'} · Total {formatCurrency(Number(order.valor_total) || 0)}
                </p>
              </div>
              <span className="text-gray-400">›</span>
            </summary>
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              {(order.pedido_itens || []).map((item, idx) => (
                <div key={idx} className="text-sm border-b pb-2 last:border-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{item.quantidade}× {item.nome}</span>
                    <span className="font-semibold">{formatCurrency(Number(order.valor_total) / Math.max(totalItens, 1))}</span>
                  </div>
                  {item.variante_nome && <p className="text-xs text-gray-500">({item.variante_nome})</p>}
                </div>
              ))}
              <div className="pt-3 border-t space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>TOTAL:</span>
                  <span className="font-bold text-lg" style={{ color: theme.primary }}>{formatCurrency(Number(order.valor_total) || 0)}</span>
                </div>
                {order.forma_pagamento && (
                  <div className="text-xs text-gray-500 pt-2">
                    💳 Pagamento: {Array.isArray(order.forma_pagamento) ? order.forma_pagamento.join(', ') : order.forma_pagamento}
                  </div>
                )}
              </div>
            </div>
          </details>

          {/* BOTÃO WHATSAPP */}
          {(theme.whatsapp || theme.telefone) && !isCancelado && (
            <a
              href={`https://wa.me/55${(theme.whatsapp || theme.telefone).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Estou acompanhando o pedido #${order.id.slice(0, 8)}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-full py-4 flex items-center justify-center gap-2 font-semibold text-sm shadow-md"
              style={{ background: '#FFFFFF', color: '#111827', border: '1px solid #E5E7EB' }}
            >
              <MessageCircle size={18} />
              Falar com o estabelecimento
            </a>
          )}

          <p className="text-center text-xs text-gray-400 pt-2">🔄 Atualização em tempo real</p>
        </div>
      </div>
    )
  }

  // ============ LISTA DE PEDIDOS (DEFAULT) ============
  return (
    <section className="px-4 py-5 pb-24" style={{ fontFamily }}>
      <h2 className="text-2xl font-bold mb-4">Meus pedidos</h2>
      {message && <p className="text-gray-500">{message}</p>}
      <div className="space-y-3">
        {orders.map(order => {
          const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.novo
          const StatusIcon = statusInfo.icon
          const totalItens = (order.pedido_itens || []).reduce((sum: number, i: any) => sum + (Number(i.quantidade) || 1), 0)
          const isCancelado = order.status === 'cancelado'
          return (
            <button
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="w-full text-left rounded-3xl p-4 shadow-sm flex items-center gap-3 hover:opacity-80 transition"
              style={{ background: '#FFFFFF' }}
            >
              <div
                className="size-12 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: isCancelado ? '#FEE2E2' : `${theme.primary}22`,
                  color: isCancelado ? '#DC2626' : theme.primary,
                }}
              >
                <StatusIcon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm" style={{ color: '#111827' }}>
                    #{order.id.slice(0, 8)}
                  </p>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: isCancelado ? '#DC2626' : theme.primary }}
                  >
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(order.created_at).toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {totalItens} {totalItens === 1 ? 'item' : 'itens'} · {formatCurrency(Number(order.valor_total))}
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function CustomerProfile({ slug, cliente, setCliente }: { slug: string; cliente: Customer; setCliente: React.Dispatch<React.SetStateAction<Customer>> }) {
  const [draft, setDraft] = useState<Customer>(cliente)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    if (!cliente.accessToken) { setMessage('Finalize seu primeiro pedido neste aparelho para ativar o perfil.'); return }
    if (!validCpf(draft.cpf)) { setMessage('Informe um CPF válido ou deixe o campo vazio.'); return }
    if (!validDate(draft.aniversario)) { setMessage('Informe o aniversário no formato DD/MM/AAAA ou deixe vazio.'); return }
    setSaving(true); setMessage('')
    const response = await fetch('/api/clientes/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      tenant_slug: slug, nome: draft.nome, telefone: draft.whatsapp, data_nascimento: isoDate(draft.aniversario),
      cpf: draft.cpf || null, endereco: [draft.endereco, draft.numero, draft.complemento].filter(Boolean).join(', '), access_token: cliente.accessToken,
    }) })
    const body = await response.json(); setSaving(false)
    if (!response.ok) { setMessage(body.error || 'Não foi possível salvar.'); return }
    const committed = { ...draft, accessToken: cliente.accessToken, tenantSlug: slug }
    setCliente(committed); localStorage.setItem(customerKey(slug), JSON.stringify(committed))
    window.dispatchEvent(new Event('delivery-cliente-updated')); setMessage('Perfil atualizado.')
  }

  const fields = [['nome','Nome'],['whatsapp','WhatsApp'],['cpf','CPF (opcional)'],['endereco','Endereço'],['numero','Número'],['bairro','Bairro'],['complemento','Complemento'],['aniversario','Aniversário']]
  return <section className="px-4 py-5 pb-24"><h2 className="text-2xl font-bold mb-4">Meu perfil</h2><div className="bg-white border rounded-2xl p-4 space-y-3">
    {fields.map(([key,label]) => <label key={key} className="block text-sm font-medium">{label}<input inputMode={key === 'cpf' || key === 'aniversario' ? 'numeric' : undefined} maxLength={key === 'aniversario' ? 10 : undefined} placeholder={key === 'aniversario' ? 'DD/MM/AAAA' : undefined} value={draft[key] || ''} onChange={event => setDraft(current => ({ ...current, [key]: key === 'cpf' ? event.target.value.replace(/\D/g, '').slice(0, 11) : key === 'aniversario' ? formatDate(event.target.value) : event.target.value }))} className="mt-1 w-full border rounded-xl px-3 py-2.5" /></label>)}
    {message && <p className="text-sm">{message}</p>}<button onClick={save} disabled={saving} className="w-full rounded-xl bg-green-600 text-white py-3 font-bold flex justify-center gap-2"><Loader2 size={18}/>{saving ? 'Salvando…' : 'Salvar perfil'}</button>
  </div></section>
}
