'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Clock, Check, Truck, X, Eye, ChevronRight, Plus, MessageCircle, ChevronLeft } from 'lucide-react'
import { Pedido, PedidoStatus } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { activeTenantId } from '@/lib/active-tenant-client'

// Hook para tocar som de novo pedido
function useSomNovoPedido(somAtivado: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pedidoIdsJaTocados = useRef<Set<string>>(new Set())

  useEffect(() => {
    audioRef.current = new Audio('/sounds/pedido-novo.mp3')
    audioRef.current.volume = 0.7
  }, [])

  const tocarSomNovosPedidos = (pedidos: Pedido[]) => {
    if (!audioRef.current || !somAtivado) return

    const pedidosNovos = pedidos.filter(
      (p) => p.status === 'novo' && !pedidoIdsJaTocados.current.has(p.id)
    )

    if (pedidosNovos.length > 0) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Ignora erro se o navegador bloquear autoplay
      })
      pedidosNovos.forEach((p) => pedidoIdsJaTocados.current.add(p.id))
    }
  }

  // Marca IDs já existentes para não tocar ao carregar
  const inicializarIds = (pedidos: Pedido[]) => {
    pedidos.forEach((p) => {
      if (p.status === 'novo') {
        pedidoIdsJaTocados.current.add(p.id)
      }
    })
  }

  return { tocarSomNovosPedidos, inicializarIds }
}

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; icon: typeof Clock }> = {
  novo: { label: 'Novo', color: 'bg-orange-100 border-orange-300', icon: Clock },
  preparando: { label: 'Preparando', color: 'bg-yellow-100 border-yellow-300', icon: Clock },
  pronto: { label: 'Pronto', color: 'bg-green-100 border-green-300', icon: Check },
  saiu: { label: 'Saiu', color: 'bg-blue-100 border-blue-300', icon: Truck },
  entregue: { label: 'Entregue', color: 'bg-gray-100 border-gray-300', icon: Check },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 border-red-300', icon: X },
}

const NEXT_STATUS: Record<PedidoStatus, PedidoStatus | null> = {
  novo: 'preparando',
  preparando: 'pronto',
  pronto: 'saiu',
  saiu: 'entregue',
  entregue: null,
  cancelado: null,
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [itensPedido, setItensPedido] = useState<any[]>([])
  const [motoboys, setMotoboys] = useState<any[]>([])
  const [filtroMotoboy, setFiltroMotoboy] = useState('todos')
  const [novosPedidosCount, setNovosPedidosCount] = useState(0)
  const [somAtivado, setSomAtivado] = useState(true)
  const supabase = createClient()
  const { tocarSomNovosPedidos, inicializarIds } = useSomNovoPedido(somAtivado)

  useEffect(() => {
    loadPedidos()

    // Subscribe para novos pedidos (polling simples)
    const interval = setInterval(loadPedidos, 10000)
    return () => clearInterval(interval)
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
      // Primeira carga: inicializa os IDs já existentes
      inicializarIds(pedidosData)
    } else {
      // Verificações subsequentes: tocar som se houver novos pedidos "novo"
      tocarSomNovosPedidos(pedidosData)
    }

    // Conta pedidos novos para badge
    const countNovos = pedidosData.filter((p) => p.status === 'novo').length
    setNovosPedidosCount(countNovos)

    setPedidos(pedidosData)
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
    alert('Novo convite copiado. O link anterior foi invalidado e este segredo não será exibido novamente.')
  }
  const updateStatus = async (pedido: Pedido, newStatus: PedidoStatus) => {
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
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

      {/* Stats Bar */}
      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        {(['novo', 'preparando', 'pronto', 'saiu'] as PedidoStatus[]).map((status) => {
          const count = pedidos.filter((p) => p.status === status).length
          const config = STATUS_CONFIG[status]
          return (
            <div
              key={status}
              className={`${config.color} border rounded-lg px-4 py-2 flex items-center gap-2 whitespace-nowrap`}
            >
              <config.icon className="w-4 h-4" />
              <span className="font-medium">{config.label}</span>
              <span className="bg-white px-2 py-0.5 rounded-full text-sm">{count}</span>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border p-3 mb-3 flex items-center gap-2">
        <label className="text-sm font-medium">Filtrar motoboy:</label>
        <select className="form-input max-w-xs" value={filtroMotoboy} onChange={e => setFiltroMotoboy(e.target.value)}><option value="todos">Todos</option><option value="sem">Sem motoboy</option>{motoboys.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
      </div>
      {/* Lista de Pedidos */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {pedidos.length > 0 ? (
          <div className="divide-y">
            {pedidos.filter((p: any) => filtroMotoboy === 'todos' || (filtroMotoboy === 'sem' ? !p.motoboy_id : p.motoboy_id === filtroMotoboy)).map((pedido) => {
              const config = STATUS_CONFIG[pedido.status]
              const StatusIcon = config.icon
              const nextStatus = NEXT_STATUS[pedido.status]

              return (
                <div
                  key={pedido.id}
                  className={`p-4 flex items-center gap-4 hover:bg-gray-50 ${
                    pedido.status === 'novo' ? 'bg-orange-50/50' : ''
                  }`}
                >
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <StatusIcon className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{pedido.id.slice(0, 8)}</span>
                      <span className="text-sm text-gray-500">{formatDate(pedido.data_criacao)}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {pedido.forma_pagamento.join(', ')} • {formatCurrency(pedido.valor_total)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select aria-label="Motoboy" className="form-input text-xs max-w-36" value={(pedido as any).motoboy_id || ''} onChange={e => atribuirMotoboy(pedido.id, e.target.value)}><option value="">Sem motoboy</option>{motoboys.filter(m => m.ativo || m.id === (pedido as any).motoboy_id).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
                    {nextStatus && (
                      <button
                        onClick={() => updateStatus(pedido, nextStatus)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
                      >
                        {STATUS_CONFIG[nextStatus].label}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}

                    {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
                      <button
                        onClick={() => updateStatus(pedido, 'cancelado')}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => loadDetalhesPedido(pedido)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido</h3>
            <p className="text-gray-500">Os pedidos aparecerão aqui quando chegarem</p>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">Pedido #{selectedPedido.id.slice(0, 8)}</h2>
                  <p className="text-gray-500">{formatDate(selectedPedido.data_criacao)}</p>
                </div>
                <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${STATUS_CONFIG[selectedPedido.status].color}`}>
                {STATUS_CONFIG[selectedPedido.status].label}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Itens */}
              <div>
                <h3 className="font-medium mb-3">Itens</h3>
                <div className="space-y-2">
                  {itensPedido.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantidade}x {item.nome}</span>
                      <span className="font-medium">{formatCurrency(item.valor_unitario * item.quantidade)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totais */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedPedido.valor_total - selectedPedido.taxa_entrega)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Taxa de entrega</span>
                  <span>{formatCurrency(selectedPedido.taxa_entrega)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(selectedPedido.valor_total)}</span>
                </div>
              </div>

              {/* Pagamento */}
              <div>
                <h3 className="font-medium mb-2">Pagamento</h3>
                <p className="text-sm text-gray-600">
                  {selectedPedido.forma_pagamento.map((forma, i) => (
                    <span key={forma}>
                      {forma}: {formatCurrency(selectedPedido.valor_pago[i] || 0)}
                      {i < selectedPedido.forma_pagamento.length - 1 && ', '}
                    </span>
                  ))}
                  {selectedPedido.troco > 0 && (
                    <span> • Troco: {formatCurrency(selectedPedido.troco)}</span>
                  )}
                </p>
              </div>

              {/* Observações */}
              {selectedPedido.observacoes && (
                <div>
                  <h3 className="font-medium mb-2">Observações</h3>
                  <p className="text-sm text-gray-600">{selectedPedido.observacoes}</p>
                </div>
              )}
              {/* Botões de ação no modal */}
              <div className="border-t pt-4"><h3 className="font-medium mb-2">Entregador</h3><select className="form-input" value={(selectedPedido as any).motoboy_id || ''} onChange={e => atribuirMotoboy(selectedPedido.id, e.target.value)}><option value="">Sem motoboy atribuido</option>{motoboys.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.tipo_comissao === 'fixa' ? `R$ ${Number(m.comissao_fixa).toFixed(2)}` : `${Number(m.comissao_percent).toFixed(1)}%`})</option>)}</select>{(selectedPedido as any).motoboy_comissao != null && <p className="text-sm text-gray-500 mt-1">Comissao registrada: {formatCurrency(Number((selectedPedido as any).motoboy_comissao))}</p>}{selectedPedido.status === 'entregue' && <button type="button" className="text-sm text-blue-600 underline mt-2 block" onClick={() => gerarConviteAvaliacao(selectedPedido.id)}>Gerar e copiar novo convite de avaliação</button>}</div>
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

                {selectedPedido.cliente_whatsapp && (
                  <a
                    href={`https://wa.me/${selectedPedido.cliente_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${selectedPedido.cliente_nome || ''}! Sobre seu pedido #${selectedPedido.id.slice(0, 8)}...`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
                    style={{ background: 'var(--green)' }}
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

