'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatarCodigoPedido } from '@/lib/utils'
import { Clock, Check, Truck, X, ChevronRight, Plus, ChefHat, Bell, Bike, LogOut, Loader2, Utensils, RefreshCw, MessageCircle, Package } from 'lucide-react'
import { PedidoStatus } from '@/types'
import { useToast } from '@/components/toast'
import { formatarFormaPagamentoDisplay } from '@/lib/whatsapp/template'

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

export default function AtendimentoPage() {
  const router = useRouter()
  // useToast() só pode ser chamado após hidratação (ToastProvider não cobre (employee))
  const toastRef = useRef<{ success: (t: string, d?: string) => void; error: (t: string, d?: string) => void } | null>(null)
  useEffect(() => {
    toastRef.current = {
      success: useToast().success,
      error: useToast().error,
    }
  }, [])
  const notify = (kind: 'success' | 'error', title: string, description?: string) => {
    const fn = toastRef.current?.[kind]
    if (fn) {
      fn(title, description)
    } else {
      console[kind === 'success' ? 'log' : 'error'](`[toast] ${title}`, description ?? '')
    }
  }
  const [loading, setLoading] = useState(true)
  const [membro, setMembro] = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [sessoesMesa, setSessoesMesa] = useState<any[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantNome, setTenantNome] = useState<string>('')
  const [tenantSlug, setTenantSlug] = useState<string>('')
  const [tab, setTab] = useState<'pedidos' | 'mesas'>('pedidos')
  const [filtroStatus, setFiltroStatus] = useState<string>('novo')
  const [somAtivado, setSomAtivado] = useState(true)
  const [novosPedidosCount, setNovosPedidosCount] = useState(0)
  const [showNovoPedido, setShowNovoPedido] = useState(false)

  // Verificar autenticação
  useEffect(() => {
    const membroStr = localStorage.getItem('membro_equipe')
    if (!membroStr) {
      router.push('/acesso')
      return
    }

    const membroData = JSON.parse(membroStr)
    if (membroData.perfil !== 'attendant') {
      // Perfil não tem acesso a esta área
      notify('error', 'Acesso não permitido')
      router.push('/acesso')
      return
    }

    setMembro(membroData)
    setTenantId(membroData.tenant_id)
    carregarDados(membroData.tenant_id)
  }, [])

  const carregarDados = async (tid: string) => {
    const supabase = createClient()

    // Buscar dados do tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('nome, slug')
      .eq('id', tid)
      .single()

    if (tenantData) {
      setTenantNome(tenantData.nome || 'Nossa Loja')
      setTenantSlug(tenantData.slug || '')
    }

    // Carregar pedidos
    const resPedidos = await fetch('/api/pedidos/list', { cache: 'no-store' })
    const dataPedidos = await resPedidos.json()

    if (resPedidos.ok && dataPedidos.pedidos) {
      setPedidos(dataPedidos.pedidos)
      const countNovos = dataPedidos.pedidos.filter((p: any) => p.status === 'novo').length
      setNovosPedidosCount(countNovos)
    }

    // Carregar mesas
    const resMesas = await fetch('/api/sessoes-mesa', { cache: 'no-store' })
    const dataMesas = await resMesas.json()
    if (resMesas.ok) {
      setSessoesMesa(dataMesas.sessoes || [])
    }

    setLoading(false)
  }

  const setupRealtime = useCallback(() => {
    if (!tenantId) return

    const supabase = createClient()
    const channel = supabase
      .channel('atendimento-pedidos')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // Recarregar pedidos
          fetch('/api/pedidos/list', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
              if (data.pedidos) {
                setPedidos(data.pedidos)
                const countNovos = data.pedidos.filter((p: any) => p.status === 'novo').length
                setNovosPedidosCount(countNovos)
              }
            })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId])

  useEffect(() => {
    const cleanup = setupRealtime()
    return () => { if (cleanup) cleanup() }
  }, [setupRealtime])

  // Backup periódico
  useEffect(() => {
    const interval = setInterval(() => {
      if (tenantId) carregarDados(tenantId)
    }, 30000)
    return () => clearInterval(interval)
  }, [tenantId])

  const atualizarStatus = async (pedido: any, novoStatus: PedidoStatus) => {
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pedido_id: pedido.id, status: novoStatus })
      })

      if (!res.ok) {
        const data = await res.json()
        notify('error', 'Erro ao atualizar', data.error || 'Erro desconhecido')
        return
      }

      notify('success', `Pedido movido para ${STATUS_CONFIG[novoStatus].label}`)
      carregarDados(tenantId)
    } catch (err: any) {
      notify('error', 'Erro ao atualizar status', err?.message)
    }
  }

  const logout = async () => {
    localStorage.removeItem('membro_equipe')
    // Limpa cookie de perfil operacional (lido pelo middleware).
    document.cookie = 'wd_employee_role=; path=/; max-age=0; samesite=lax'
    // Limpa sessão do Supabase para o guard server-side identificar
    // que não há mais usuário autenticado.
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch { /* ignora erro de logout */ }
    router.push('/acesso')
  }

  // Filtros
  const pedidosFiltrados = tab === 'pedidos' ? (
    filtroStatus === 'todos'
      ? pedidos.filter(p => p.status !== 'cancelado')
      : pedidos.filter(p => p.status === filtroStatus)
  ) : []

  const mesasAbertas = sessoesMesa.filter(s => s.status === 'aberta')

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="animate-spin text-green-600 mx-auto mb-4" size={40} />
          <p className="text-gray-500">Carregando atendimento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Ambiente Operacional */}
      <header className="bg-green-600 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo + Nome da Loja */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Utensils size={24} />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">ATENDIMENTO</h1>
                <p className="text-green-200 text-xs">{tenantNome}</p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSomAtivado(!somAtivado)}
                className="p-2 rounded-lg transition"
                style={{ background: somAtivado ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }}
                title={somAtivado ? 'Som ativado' : 'Som desativado'}
              >
                {somAtivado ? '🔔' : '🔕'}
              </button>
              <button
                onClick={() => carregarDados(tenantId)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                title="Atualizar"
              >
                <RefreshCw size={20} />
              </button>
              <button
                onClick={logout}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Saudação */}
          <p className="mt-2 text-green-100 text-sm">
            Bem-vindo, {membro?.nome} 👋
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            <button
              onClick={() => setTab('pedidos')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
                tab === 'pedidos'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Package size={18} />
              Pedidos Hoje
              {novosPedidosCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold bg-orange-500 text-white rounded-full animate-pulse">
                  {novosPedidosCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('mesas')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
                tab === 'mesas'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Utensils size={18} />
              Mesas Ativas
              {mesasAbertas.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                  {mesasAbertas.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Botão Novo Pedido */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <Link
          href="/acesso/atendimento/novo"
          className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white rounded-xl font-medium text-lg hover:bg-green-700 transition active:scale-[0.98]"
        >
          <Plus size={22} />
          Novo Pedido
        </Link>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {tab === 'pedidos' && (
          <>
            {/* Filtros de Status */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {[
                { key: 'novo', label: 'Novo', count: pedidos.filter(p => p.status === 'novo').length, color: 'orange' },
                { key: 'preparando', label: 'Preparando', count: pedidos.filter(p => p.status === 'preparando').length, color: 'yellow' },
                { key: 'pronto', label: 'Pronto', count: pedidos.filter(p => p.status === 'pronto').length, color: 'green' },
                { key: 'saiu', label: 'Saiu', count: pedidos.filter(p => p.status === 'saiu').length, color: 'blue' },
                { key: 'entregue', label: 'Entregue', count: pedidos.filter(p => p.status === 'entregue').length, color: 'gray' },
              ].map(({ key, label, count, color }) => (
                <button
                  key={key}
                  onClick={() => setFiltroStatus(filtroStatus === key ? 'todos' : key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition border ${
                    filtroStatus === key
                      ? color === 'orange' ? 'bg-orange-100 text-orange-700 border-orange-300'
                      : color === 'yellow' ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      : color === 'green' ? 'bg-green-100 text-green-700 border-green-300'
                      : color === 'blue' ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-gray-100 text-gray-700 border-gray-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {/* Lista de Pedidos */}
            {pedidosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Package size={64} className="mx-auto mb-4 text-gray-300" />
                <p className="text-xl text-gray-500 font-medium">Nenhum pedido encontrado</p>
                <p className="text-sm text-gray-400 mt-1">
                  {filtroStatus === 'todos' ? 'Aguarde novos pedidos' : `Nenhum pedido com status "${STATUS_CONFIG[filtroStatus as PedidoStatus]?.label}"`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pedidosFiltrados.map((pedido) => {
                  const config = STATUS_CONFIG[pedido.status as PedidoStatus] || STATUS_CONFIG.novo
                  const StatusIcon = config.icon
                  const nextStatus = NEXT_STATUS[pedido.status as PedidoStatus]

                  return (
                    <div
                      key={pedido.id}
                      className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm ${
                        pedido.status === 'novo' ? 'border-orange-300 ring-2 ring-orange-200' : 'border-gray-200'
                      }`}
                    >
                      {/* Header */}
                      <div className={`px-4 py-3 ${pedido.status === 'novo' ? 'bg-orange-50' : pedido.status === 'preparando' ? 'bg-yellow-50' : pedido.status === 'pronto' ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold">
                              {formatarCodigoPedido(pedido.id, pedido.data_criacao, pedido.codigo)}
                            </h3>
                            {pedido.tipo_pedido === 'mesa' && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                                🍽️ MESA
                              </span>
                            )}
                            {pedido.tipo_pedido === 'retirada' && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                                🏪 RETIRADA
                              </span>
                            )}
                            {(!pedido.tipo_pedido || pedido.tipo_pedido === 'delivery') && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                                🚚 DELIVERY
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${config.bgColor} ${config.color}`}>
                            <StatusIcon size={12} className="inline mr-1" />
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock size={12} />
                          {formatTime(pedido.data_criacao)}
                          {pedido.cliente_nome && (
                            <>
                              <span>•</span>
                              <span>{pedido.cliente_nome}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Endereço */}
                      {pedido.endereco_entrega && (
                        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600 border-b">
                          📍 {pedido.endereco_entrega}
                          {pedido.numero_entrega ? `, ${pedido.numero_entrega}` : ''}
                          {pedido.bairro_entrega ? ` - ${pedido.bairro_entrega}` : ''}
                        </div>
                      )}

                      {/* Resumo dos itens */}
                      <div className="px-4 py-3 border-b">
                        <p className="text-sm font-medium text-gray-700 mb-1">Itens</p>
                        <p className="text-xs text-gray-500">
                          {/* Será preenchido dinamicamente se necessário */}
                          Ver detalhes para informações completas
                        </p>
                      </div>

                      {/* Total */}
                      <div className="px-4 py-3 border-b flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Forma de pagamento</p>
                          <p className="text-sm font-medium">
                            {formatarFormaPagamentoDisplay(pedido.forma_pagamento)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(pedido.valor_total)}
                          </p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="p-4 bg-gray-50">
                        {nextStatus && (
                          <button
                            onClick={() => atualizarStatus(pedido, nextStatus)}
                            className="w-full py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
                          >
                            <ChevronRight size={18} />
                            AVANÇAR PARA {STATUS_CONFIG[nextStatus].label.toUpperCase()}
                          </button>
                        )}
                        {!nextStatus && pedido.status === 'entregue' && (
                          <div className="text-center text-sm text-gray-500 py-2">
                            ✓ Pedido concluído
                          </div>
                        )}
                        {pedido.status === 'cancelado' && (
                          <div className="text-center text-sm text-red-500 py-2">
                            ✕ Pedido cancelado
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'mesas' && (
          <>
            {mesasAbertas.length === 0 ? (
              <div className="text-center py-12">
                <Utensils size={64} className="mx-auto mb-4 text-gray-300" />
                <p className="text-xl text-gray-500 font-medium">Nenhuma mesa ativa</p>
                <p className="text-sm text-gray-400 mt-1">As mesas abertas aparecerão aqui</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mesasAbertas.map((mesa) => (
                  <div key={mesa.id} className="bg-white rounded-2xl border-2 border-amber-300 overflow-hidden">
                    <div className="bg-amber-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-amber-800">
                          🍽️ Mesa {mesa.numero || mesa.codigo}
                        </h3>
                        <span className="px-2 py-1 bg-amber-200 text-amber-800 rounded-full text-xs font-bold">
                          ABERTA
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-gray-600">
                        Pedido atual: <span className="font-medium">{mesa.pedido_atual || '-'}</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Valor acumulado: <span className="font-bold text-green-600">{formatCurrency(mesa.valor_acumulado || 0)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
