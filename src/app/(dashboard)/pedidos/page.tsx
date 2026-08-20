'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Clock, Check, Truck, X, Eye, ChevronRight, Plus, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Pedido, PedidoStatus } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { activeTenantId } from '@/lib/active-tenant-client'

// Hook para tocar som de novo pedido em LOOP
function useSomNovoPedido(somAtivado: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pedidoIdsJaTocados = useRef<Set<string>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pedidosEmLoop = useRef<Set<string>>(new Set())

  useEffect(() => {
    audioRef.current = new Audio('/sounds/pedido-novo.mp3')
    audioRef.current.volume = 0.7
    audioRef.current.addEventListener('ended', () => {
      // Quando o som termina, se ainda houver pedidos "novo" sem confirmar, toca novamente
      if (pedidosEmLoop.current.size > 0 && somAtivado) {
        setTimeout(() => {
          if (pedidosEmLoop.current.size > 0 && audioRef.current) {
            audioRef.current.currentTime = 0
            audioRef.current.play().catch(() => {})
          }
        }, 1000) // Espera 1 segundo e toca novamente
      }
    })
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const adicionarAoLoop = (pedidoId: string) => {
    pedidosEmLoop.current.add(pedidoId)
    // Toca o som imediatamente
    if (audioRef.current && somAtivado) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }
  }

  const removerDoLoop = (pedidoId: string) => {
    pedidosEmLoop.current.delete(pedidoId)
    // Para o som se não houver mais pedidos em loop
    if (pedidosEmLoop.current.size === 0 && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const inicializarIds = (pedidos: Pedido[]) => {
    pedidos.forEach((p) => {
      if (p.status === 'novo') {
        pedidoIdsJaTocados.current.add(p.id)
        adicionarAoLoop(p.id)
      }
    })
  }

  // Remove do loop quando o status muda de "novo"
  const verificarMudancaStatus = useCallback((pedidos: Pedido[]) => {
    pedidos.forEach(p => {
      if (p.status !== 'novo' && pedidosEmLoop.current.has(p.id)) {
        removerDoLoop(p.id)
      }
    })
  }, [])

  return { inicializarIds, adicionarAoLoop, removerDoLoop, verificarMudancaStatus }
}

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

// Status que devem aparecer na barra de estatísticas
const STATUS_LISTA: PedidoStatus[] = ['novo', 'preparando', 'pronto', 'saiu', 'entregue']

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [itensPedido, setItensPedido] = useState<any[]>([])
  const [motoboys, setMotoboys] = useState<any[]>([])
  const [novosPedidosCount, setNovosPedidosCount] = useState(0)
  const [somAtivado, setSomAtivado] = useState(true)
  const [detalhesExpandidos, setDetalhesExpandidos] = useState<Set<string>>(new Set())
  const supabase = createClient()
  const { inicializarIds, adicionarAoLoop, removerDoLoop, verificarMudancaStatus } = useSomNovoPedido(somAtivado)

  useEffect(() => {
    let subscription: any = null

    const setupRealtime = async () => {
      const tenantId = await activeTenantId()
      if (!tenantId) { setLoading(false); return }

      // 1. Carrega pedidos iniciais
      const { data } = await supabase
        .from('pedidos')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('data_criacao', { ascending: false })
        .limit(50)

      const pedidosData = data || []
      inicializarIds(pedidosData)

      const countNovos = pedidosData.filter((p) => p.status === 'novo').length
      setNovosPedidosCount(countNovos)
      setPedidos(pedidosData)

      const { data: entregadores } = await supabase.from('motoboys').select('*').eq('tenant_id', tenantId).order('nome')
      setMotoboys(entregadores || [])
      setLoading(false)

      // 2. Inscreve para receber novos pedidos INSTANTANEAMENTE
      subscription = supabase
        .channel('pedidos-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'pedidos',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            const novoPedido = payload.new as Pedido
            setPedidos((prev) => {
              if (prev.some(p => p.id === novoPedido.id)) return prev
              const novosPedidos = [novoPedido, ...prev]
              adicionarAoLoop(novoPedido.id)
              const count = novosPedidos.filter((p) => p.status === 'novo').length
              setNovosPedidosCount(count)
              return novosPedidos
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pedidos',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            const atualizado = payload.new as Pedido
            setPedidos((prev) => {
              const novos = prev.map(p => p.id === atualizado.id ? atualizado : p)
              // Remove do loop se status mudou de "novo"
              if (atualizado.status !== 'novo') {
                removerDoLoop(atualizado.id)
              }
              const count = novos.filter((p) => p.status === 'novo').length
              setNovosPedidosCount(count)
              return novos
            })
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [])

  const loadPedidos = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) { setLoading(false); return }

    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('data_criacao', { ascending: false })
      .limit(50)

    const pedidosData = data || []

    if (loading) {
      inicializarIds(pedidosData)
    }

    const countNovos = pedidosData.filter((p) => p.status === 'novo').length
    setNovosPedidosCount(countNovos)

    setPedidos(pedidosData)
    verificarMudancaStatus(pedidosData)

    const { data: entregadores } = await supabase.from('motoboys').select('*').eq('tenant_id', tenantId).order('nome')
    setMotoboys(entregadores || [])
    setLoading(false)
  }

  const atribuirMotoboy = async (pedidoId: string, motoboyId: string) => {
    const { error } = await supabase.from('pedidos').update({ motoboy_id: motoboyId || null }).eq('id', pedidoId)
    if (error) return alert('Erro ao atribuir motoboy')
    setSelectedPedido((p: any) => p?.id === pedidoId ? { ...p, motoboy_id: motoboyId || null } : p)
    loadPedidos()
  }

  const gerarConviteAvaliacao = async (pedidoId: string) => {
    const response = await fetch(`/api/pedidos/${encodeURIComponent(pedidoId)}/avaliacao-convite`, { method: 'POST' })
    const body = await response.json()
    if (!response.ok) return alert(body.error || 'Não foi possível gerar o convite')
    const link = `${window.location.origin}/avaliar/${body.token}`
    await navigator.clipboard.writeText(link)
    alert('Novo convite copiado. O link anterior foi invalidado.')
  }

  const updateStatus = async (pedido: Pedido, newStatus: PedidoStatus) => {
    // Remove do loop de som se estiver mudando de "novo"
    if (pedido.status === 'novo') {
      removerDoLoop(pedido.id)
    }

    const { error } = await supabase
      .from('pedidos')
      .update({
        status: newStatus,
        data_atualizacao: new Date().toISOString()
      })
      .eq('id', pedido.id)

    if (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status')
    } else {
      loadPedidos()
    }
  }

  const loadDetalhesPedido = async (pedido: Pedido) => {
    setSelectedPedido(pedido)
    const { data } = await supabase
      .from('pedido_itens')
      .select('*')
      .eq('pedido_id', pedido.id)
    setItensPedido(data || [])
  }

  const toggleDetalhes = (pedidoId: string) => {
    setDetalhesExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(pedidoId)) {
        next.delete(pedidoId)
      } else {
        next.add(pedidoId)
      }
      return next
    })
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateFull = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFormaPagamento = (forma: any) => {
    if (Array.isArray(forma)) return forma.join(', ')
    return forma || '-'
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow mb-2">Atendimento</div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1" style={{ color: 'var(--ink)' }}>
              Pedidos
              {novosPedidosCount > 0 && (
                <span className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white text-base font-medium rounded-full animate-pulse">
                  🔔 {novosPedidosCount} novo{novosPedidosCount > 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p className="hint">Gerencie os pedidos do seu delivery</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSomAtivado(!somAtivado)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border ${
                somAtivado
                  ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                  : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
              }`}
              title={somAtivado ? 'Som ativado - clique para silenciar' : 'Som silenciado - clique para ativar'}
            >
              {somAtivado ? '🔊 Som' : '🔇 Mudo'}
            </button>
            <Link
              href="/pedidos/novo"
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Pedido
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Bar - COM ENTREGUES */}
      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        {STATUS_LISTA.map((status) => {
          const count = pedidos.filter((p) => p.status === status).length
          const config = STATUS_CONFIG[status]
          return (
            <div
              key={status}
              className={`${config.bgColor} border rounded-lg px-4 py-2 flex items-center gap-2 whitespace-nowrap`}
            >
              <config.icon className="w-4 h-4" />
              <span className={`font-medium ${config.color}`}>{config.label}</span>
              <span className="bg-white px-2 py-0.5 rounded-full text-sm font-bold">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Lista de Pedidos em CARDS */}
      <div className="space-y-4">
        {pedidos.length > 0 ? (
          pedidos.map((pedido) => {
            const config = STATUS_CONFIG[pedido.status]
            const StatusIcon = config.icon
            const nextStatus = NEXT_STATUS[pedido.status]
            const isExpanded = detalhesExpandidos.has(pedido.id)
            const isNovo = pedido.status === 'novo'

            // Pega o motoboy atribuído
            const motoboyAtribuido = motoboys.find(m => m.id === (pedido as any).motoboy_id)

            return (
              <div
                key={pedido.id}
                className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden transition-all ${
                  isNovo ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Header do Card - Sempre visível */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Lado esquerdo - Info principal */}
                    <div className="flex-1">
                      {/* Código do pedido */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {(pedido as any).codigo || `#${pedido.id.slice(0, 8)}`}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </div>

                      {/* Nome do cliente */}
                      <p className="font-semibold text-gray-900 mb-1">
                        {(pedido as any).cliente_nome || 'Cliente não identificado'}
                      </p>

                      {/* WhatsApp */}
                      {(pedido as any).cliente_whatsapp && (
                        <p className="text-sm text-gray-500 mb-1">
                          📱 {(pedido as any).cliente_whatsapp}
                        </p>
                      )}

                      {/* Data e hora */}
                      <p className="text-sm text-gray-500 mb-2">
                        🕐 {formatDateFull(pedido.data_criacao)}
                      </p>
                    </div>

                    {/* Lado direito - Valor e ações */}
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600 mb-2">
                        {formatCurrency(pedido.valor_total)}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        {formatFormaPagamento((pedido as any).forma_pagamento)}
                      </p>

                      {/* Botões de ação */}
                      <div className="flex items-center gap-2 justify-end">
                        {nextStatus && (
                          <button
                            onClick={() => updateStatus(pedido, nextStatus)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-sm"
                          >
                            {STATUS_CONFIG[nextStatus].label}
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}

                        {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
                          <button
                            onClick={() => updateStatus(pedido, 'cancelado')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Cancelar pedido"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}

                        <button
                          onClick={() => loadDetalhesPedido(pedido)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Ver detalhes completos"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Resumo dos itens (sempre visível) */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">📋 Resumo do pedido:</p>
                    <p className="text-sm text-gray-600">
                      {(pedido as any).tipo_entrega === 'retirada'
                        ? '🏪 Retirada no local'
                        : `📍 ${(pedido as any).endereco_entrega || '-'}${((pedido as any).numero_entrega ? `, ${(pedido as any).numero_entrega}` : '')}${((pedido as any).bairro_entrega ? ` - ${(pedido as any).bairro_entrega}` : '')}`
                      }
                    </p>
                    {(pedido as any).observacoes && (
                      <p className="text-sm text-amber-600 mt-1">
                        📝 Obs: {(pedido as any).observacoes}
                      </p>
                    )}
                  </div>

                  {/* Botão para expandir/colapsar mais detalhes */}
                  <button
                    onClick={() => toggleDetalhes(pedido.id)}
                    className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-1 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Ocultar detalhes
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Ver mais detalhes
                      </>
                    )}
                  </button>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                      {/* Motoboy */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">🛵 Motoboy:</span>
                        <select
                          className="form-input text-sm max-w-40"
                          value={(pedido as any).motoboy_id || ''}
                          onChange={e => atribuirMotoboy(pedido.id, e.target.value)}
                        >
                          <option value="">Selecionar...</option>
                          {motoboys.filter(m => m.ativo || m.id === (pedido as any).motoboy_id).map(m => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* Taxa de entrega */}
                      {(pedido as any).taxa_entrega > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Taxa de entrega:</span>
                          <span>{formatCurrency((pedido as any).taxa_entrega || 0)}</span>
                        </div>
                      )}

                      {/* Troco */}
                      {(pedido as any).troco_para > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Troco para:</span>
                          <span>{formatCurrency((pedido as any).troco_para)}</span>
                        </div>
                      )}

                      {/* Cupom */}
                      {(pedido as any).cupom_aplicado && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Cupom usado:</span>
                          <span className="text-green-600 font-medium">{(pedido as any).cupom_aplicado}</span>
                        </div>
                      )}

                      {/* Tempo estimado */}
                      {(pedido as any).tempo_estimado_min && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tempo estimado:</span>
                          <span>{(pedido as any).tempo_estimado_min} min</span>
                        </div>
                      )}

                      {/* Complemento */}
                      {(pedido as any).complemento_entrega && (
                        <div className="text-sm">
                          <span className="text-gray-600">Complemento:</span>
                          <p className="text-gray-700">{(pedido as any).complemento_entrega}</p>
                        </div>
                      )}

                      {/* WhatsApp rápido */}
                      {(pedido as any).cliente_whatsapp && (
                        <a
                          href={`https://wa.me/${(pedido as any).cliente_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${(pedido as any).cliente_nome || ''}! Sobre seu pedido ${(pedido as any).codigo || ''}...`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Enviar WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        }) : (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido</h3>
            <p className="text-gray-500">Os pedidos aparecerão aqui quando chegarem</p>
          </div>
        )}
      </div>

      {/* Modal de Detalhes Completos */}
      {selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">Pedido {(selectedPedido as any).codigo || `#${selectedPedido.id.slice(0, 8)}`}</h2>
                  <p className="text-gray-500">{formatDateFull(selectedPedido.data_criacao)}</p>
                </div>
                <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${STATUS_CONFIG[selectedPedido.status].bgColor} ${STATUS_CONFIG[selectedPedido.status].color}`}>
                {STATUS_CONFIG[selectedPedido.status].label}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Cliente */}
              <div>
                <h3 className="font-medium mb-2">👤 Cliente</h3>
                <p className="text-gray-900 font-medium">{(selectedPedido as any).cliente_nome || 'Não identificado'}</p>
                {(selectedPedido as any).cliente_whatsapp && (
                  <p className="text-gray-600">📱 {(selectedPedido as any).cliente_whatsapp}</p>
                )}
              </div>

              {/* Itens */}
              <div>
                <h3 className="font-medium mb-3">📋 Itens do Pedido</h3>
                <div className="space-y-2">
                  {itensPedido.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.quantidade}x {item.nome}
                        {item.variante_nome && <span className="text-gray-500"> ({item.variante_nome})</span>}
                        {item.complementos && item.complementos.length > 0 && (
                          <span className="text-gray-500"> + {JSON.parse(item.complementos).length} complementos</span>
                        )}
                      </span>
                      <span className="font-medium">{formatCurrency(item.valor_unitario * item.quantidade)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totais */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency((selectedPedido as any).valor_subtotal || (selectedPedido.valor_total - ((selectedPedido as any).taxa_entrega || 0)))}</span>
                </div>
                {((selectedPedido as any).taxa_entrega > 0 || selectedPedido.taxa_entrega > 0) && (
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega</span>
                    <span>{formatCurrency((selectedPedido as any).taxa_entrega || selectedPedido.taxa_entrega)}</span>
                  </div>
                )}
                {(selectedPedido as any).valor_desconto > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto</span>
                    <span>-{formatCurrency((selectedPedido as any).valor_desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-green-600">{formatCurrency(selectedPedido.valor_total)}</span>
                </div>
              </div>

              {/* Pagamento */}
              <div>
                <h3 className="font-medium mb-2">💳 Pagamento</h3>
                <p className="text-sm text-gray-600">
                  {formatFormaPagamento((selectedPedido as any).forma_pagamento)}
                  {(selectedPedido as any).troco_para > 0 && (
                    <span> • Troco para: {formatCurrency((selectedPedido as any).troco_para)}</span>
                  )}
                </p>
              </div>

              {/* Entrega */}
              <div>
                <h3 className="font-medium mb-2">🚚 {((selectedPedido as any).tipo_entrega === 'retirada') ? 'Retirada' : 'Entrega'}</h3>
                {((selectedPedido as any).tipo_entrega === 'retirada') ? (
                  <p className="text-sm text-gray-600">Cliente vai retirar no local</p>
                ) : (
                  <p className="text-sm text-gray-600">
                    {((selectedPedido as any).endereco_entrega || '-')}{((selectedPedido as any).numero_entrega ? `, ${(selectedPedido as any).numero_entrega}` : '')}
                    {((selectedPedido as any).bairro_entrega ? ` - ${(selectedPedido as any).bairro_entrega}` : '')}
                    {((selectedPedido as any).complemento_entrega ? ` (${(selectedPedido as any).complemento_entrega})` : '')}
                  </p>
                )}
              </div>

              {/* Observações */}
              {((selectedPedido as any).observacoes) && (
                <div>
                  <h3 className="font-medium mb-2">📝 Observações</h3>
                  <p className="text-sm text-gray-600">{((selectedPedido as any).observacoes)}</p>
                </div>
              )}

              {/* Cupom */}
              {((selectedPedido as any).cupom_aplicado) && (
                <div>
                  <h3 className="font-medium mb-2">🎟️ Cupom</h3>
                  <p className="text-sm text-green-600 font-medium">{((selectedPedido as any).cupom_aplicado)}</p>
                </div>
              )}

              {/* Motoboy */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">🛵 Entregador</h3>
                <select
                  className="form-input w-full"
                  value={(selectedPedido as any).motoboy_id || ''}
                  onChange={e => atribuirMotoboy(selectedPedido.id, e.target.value)}
                >
                  <option value="">Selecionar entregador...</option>
                  {motoboys.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.tipo_comissao === 'fixa' ? `R$ ${Number(m.comissao_fixa).toFixed(2)}` : `${Number(m.comissao_percent).toFixed(1)}%`})
                    </option>
                  ))}
                </select>
                {((selectedPedido as any).motoboy_comissao != null) && (
                  <p className="text-sm text-gray-500 mt-1">
                    Comissão registrada: {formatCurrency(Number((selectedPedido as any).motoboy_comissao))}
                  </p>
                )}
              </div>

              {/* Avaliação */}
              {selectedPedido.status === 'entregue' && (
                <button
                  type="button"
                  className="text-sm text-blue-600 underline mt-2 block"
                  onClick={() => gerarConviteAvaliacao(selectedPedido.id)}
                >
                  Gerar e copiar novo convite de avaliação
                </button>
              )}

              {/* Botões de ação */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                {NEXT_STATUS[selectedPedido.status] && (
                  <button
                    onClick={() => {
                      updateStatus(selectedPedido, NEXT_STATUS[selectedPedido.status]!)
                      setSelectedPedido({ ...selectedPedido, status: NEXT_STATUS[selectedPedido.status]! })
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                  >
                    {STATUS_CONFIG[NEXT_STATUS[selectedPedido.status]!].label}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {selectedPedido.status !== 'cancelado' &&
                  selectedPedido.status !== 'entregue' &&
                  NEXT_STATUS[selectedPedido.status] && (
                    <button
                      onClick={() => {
                        if (!confirm('Cancelar este pedido?')) return
                        updateStatus(selectedPedido, 'cancelado')
                        setSelectedPedido({ ...selectedPedido, status: 'cancelado' })
                      }}
                      className="px-3 py-2 text-red-600 border border-red-200 hover:bg-red-50 text-sm rounded-lg flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}

                {((selectedPedido as any).cliente_whatsapp) && (
                  <a
                    href={`https://wa.me/${((selectedPedido as any).cliente_whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${((selectedPedido as any).cliente_nome || '')}! Sobre seu pedido ${((selectedPedido as any).codigo || '')}...`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
