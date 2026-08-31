'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Clock, Check, Truck, X, Eye, ChevronRight, Plus, MessageCircle, ChevronDown, ChevronUp, Printer, Tag, Pencil, Save, Trash2, Search, AlertTriangle, Percent, Copy, Star } from 'lucide-react'
import { Pedido, PedidoStatus } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { activeTenantId } from '@/lib/active-tenant-client'
import { gerarMensagemWhatsApp } from '@/lib/whatsapp/template'

// Componente de alerta de tempo
function TempoAlerta({ dataCriacao, tempoEstimadoMin }: { dataCriacao: string; tempoEstimadoMin?: number }) {
  const [minutosDecorridos, setMinutosDecorridos] = useState(0)

  useEffect(() => {
    const calcular = () => {
      const diff = (Date.now() - new Date(dataCriacao).getTime()) / 60000
      setMinutosDecorridos(Math.floor(diff))
    }
    calcular()
    const interval = setInterval(calcular, 30000) // Atualiza a cada 30s
    return () => clearInterval(interval)
  }, [dataCriacao])

  if (!tempoEstimadoMin) return null

  const percentual = (minutosDecorridos / tempoEstimadoMin) * 100

  if (percentual >= 100) {
    const atraso = minutosDecorridos - tempoEstimadoMin
    return (
      <div className="flex items-center gap-2 p-2 bg-red-100 border border-red-300 rounded-lg animate-pulse">
        <span className="text-xl">⏰</span>
        <div>
          <p className="text-red-700 font-bold text-sm">ATRASADO</p>
          <p className="text-red-600 text-xs">+{atraso} min de atraso</p>
        </div>
      </div>
    )
  }

  if (percentual >= 80) {
    const restantes = tempoEstimadoMin - minutosDecorridos
    return (
      <div className="flex items-center gap-2 p-2 bg-amber-100 border border-amber-300 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <div>
          <p className="text-amber-700 font-bold text-sm">ATENÇÃO</p>
          <p className="text-amber-600 text-xs">Faltam ~{restantes} min</p>
        </div>
      </div>
    )
  }

  const restantes = tempoEstimadoMin - minutosDecorridos
  return (
    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
      <Check className="w-4 h-4 text-green-600" />
      <span className="text-green-700 text-xs font-medium">⏱️ {restantes} min restantes</span>
    </div>
  )
}

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

// Status que devem aparecer na barra de estatísticas (cancelado fica por último)
const STATUS_LISTA: PedidoStatus[] = ['novo', 'preparando', 'pronto', 'saiu', 'entregue', 'cancelado']

// Componente para editar UM item com autocomplete de produtos do banco
function ItemEditor({ item, idx, onChange, onRemove, tenantId }: {
  item: any
  idx: number
  onChange: (idx: number, novo: any) => void
  onRemove: (idx: number) => void
  tenantId: string
}) {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<any[]>([])
  const [complementosDb, setComplementosDb] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [showProdutos, setShowProdutos] = useState(false)
  const [showComps, setShowComps] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const carregar = async () => {
      const { data: cats } = await supabase.from('categorias_produtos').select('id, nome').eq('tenant_id', tenantId).order('nome')
      setCategorias(cats || [])
      const { data: prods } = await supabase.from('produtos').select('id, nome, preco, imagem_url, categoria_id, ativo').eq('tenant_id', tenantId).eq('ativo', true).order('nome')
      setProdutos(prods || [])
      const { data: comps } = await supabase.from('complementos').select('id, nome, preco, ativo, categoria_id').eq('tenant_id', tenantId).eq('ativo', true).order('nome')
      setComplementosDb(comps || [])
    }
    carregar()
  }, [tenantId])

  const selecionarProduto = (prod: any) => {
    onChange(idx, { ...item, produto_id: prod.id, nome: prod.nome, valor_unitario: Number(prod.preco) })
    setShowProdutos(false)
    setBusca('')
  }

  const toggleComplemento = (comp: any) => {
    const compsAtuais = Array.isArray(item.complementos)
      ? (typeof item.complementos === 'string' ? JSON.parse(item.complementos) : item.complementos)
      : []
    const existe = compsAtuais.find((c: any) => c.id === comp.id)
    let novos: any[]
    if (existe) {
      novos = compsAtuais.filter((c: any) => c.id !== comp.id)
    } else {
      novos = [...compsAtuais, { id: comp.id, nome: comp.nome, valor: Number(comp.preco), quantidade: 1 }]
    }
    onChange(idx, { ...item, complementos: novos })
  }

  const alterarQtdComplemento = (compId: string, delta: number) => {
    const compsAtuais = Array.isArray(item.complementos)
      ? (typeof item.complementos === 'string' ? JSON.parse(item.complementos) : item.complementos)
      : []
    const novos = compsAtuais.map((c: any) =>
      c.id === compId ? { ...c, quantidade: Math.max(1, (c.quantidade || 1) + delta) } : c
    )
    onChange(idx, { ...item, complementos: novos })
  }

  const produtosFiltrados = produtos.filter((p) =>
    !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const compsAtuais = Array.isArray(item.complementos)
    ? (typeof item.complementos === 'string' ? JSON.parse(item.complementos) : item.complementos)
    : []

  return (
    <div className="bg-gray-50 p-3 rounded-lg space-y-2">
      <div className="flex items-start gap-2">
        {/* BUSCA PRODUTO */}
        <div className="flex-1 relative">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="form-input text-sm w-full pl-8"
              placeholder="Buscar produto..."
              value={item.nome || ''}
              onFocus={() => setShowProdutos(true)}
              onChange={(e) => {
                onChange(idx, { ...item, nome: e.target.value })
                setBusca(e.target.value)
                setShowProdutos(true)
              }}
            />
          </div>
          {showProdutos && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {produtosFiltrados.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">Nenhum produto encontrado</p>
              ) : (
                produtosFiltrados.slice(0, 30).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selecionarProduto(p)}
                    className="w-full text-left p-2 hover:bg-green-50 flex items-center gap-3 text-sm border-b last:border-b-0"
                  >
                    {p.imagem_url ? (
                      <img src={p.imagem_url} alt={p.nome} className="size-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="size-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                        🍽️
                      </div>
                    )}
                    <span className="flex-1">{p.nome}</span>
                    <span className="font-medium text-green-600">{formatCurrency(Number(p.preco))}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* QTD */}
        <input
          type="number"
          min={1}
          className="form-input text-sm w-16 text-center"
          value={item.quantidade || 1}
          onChange={(e) => onChange(idx, { ...item, quantidade: Number(e.target.value) || 1 })}
          title="Quantidade"
        />

        {/* VALOR */}
        <input
          type="number"
          step="0.01"
          className="form-input text-sm w-24"
          value={item.valor_unitario || 0}
          onChange={(e) => onChange(idx, { ...item, valor_unitario: Number(e.target.value) || 0 })}
          title="Valor unitário"
        />

        {/* REMOVER */}
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="p-2 text-red-600 hover:bg-red-50 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* COMPLEMENTOS */}
      <div className="ml-2">
        <button
          type="button"
          onClick={() => setShowComps(!showComps)}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          {showComps ? '▲ Ocultar' : '▼ Adicionar'} complementos ({compsAtuais.length})
        </button>
        {showComps && (
          <div className="mt-1 p-2 bg-white border rounded-lg max-h-40 overflow-y-auto">
            {complementosDb.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhum complemento cadastrado</p>
            ) : (
              complementosDb.map((c) => {
                const selecionado = compsAtuais.find((cc: any) => cc.id === c.id)
                return (
                  <div key={c.id} className="flex items-center justify-between py-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={!!selecionado}
                        onChange={() => toggleComplemento(c)}
                        className="size-3"
                      />
                      <span>{c.nome}</span>
                    </label>
                    <span className="text-green-600 mr-2">+{formatCurrency(Number(c.preco))}</span>
                    {selecionado && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => alterarQtdComplemento(c.id, -1)} className="px-1 bg-gray-200 rounded">-</button>
                        <span>{selecionado.quantidade}</span>
                        <button type="button" onClick={() => alterarQtdComplemento(c.id, 1)} className="px-1 bg-gray-200 rounded">+</button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
        {compsAtuais.length > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            {compsAtuais.map((c: any) => (
              <span key={c.id} className="mr-2">+{c.quantidade}x {c.nome}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Componente para mostrar os itens do pedido (carrega sob demanda)
function ItensPedido({ pedidoId, compacto = false }: { pedidoId: string; compacto?: boolean }) {
  const [itens, setItens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data } = await supabase
        .from('pedido_itens')
        .select('*')
        .eq('pedido_id', pedidoId)
      if (mounted) {
        setItens(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [pedidoId])

  if (loading) return <div className="p-3 text-xs text-gray-400">Carregando itens...</div>
  if (!itens.length) return null

  const LIMITE_VISIVEL = 3
  const mostrarTodos = expandido || !compacto || itens.length <= LIMITE_VISIVEL
  const itensVisiveis = mostrarTodos ? itens : itens.slice(0, LIMITE_VISIVEL)
  const temMais = compacto && itens.length > LIMITE_VISIVEL

  return (
    <div className="p-3 border-b border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-1">🛒 ITENS ({itens.length}):</p>
      <div className="space-y-1">
        {itensVisiveis.map((item) => {
          const comps = Array.isArray(item.complementos)
            ? (typeof item.complementos === 'string' ? JSON.parse(item.complementos) : item.complementos)
            : []
          return (
            <div key={item.id} className="text-xs">
              <div className="flex justify-between gap-1">
                <span className="truncate"><strong>{item.quantidade}x {item.nome}</strong>{item.variante_nome ? ` (${item.variante_nome})` : ''}</span>
                <span className="font-medium whitespace-nowrap">{formatCurrency(item.valor_unitario * item.quantidade)}</span>
              </div>
              {comps.length > 0 && (
                <div className="ml-2 text-gray-600 text-xs font-medium">
                  {comps.map((c: any, i: number) => (
                    <div key={i} className="flex justify-between gap-4">
                      <span>+ {c.quantidade > 1 ? `${c.quantidade}x` : ''} {c.nome}</span>
                      <span className="whitespace-nowrap">{formatCurrency(c.valor * (c.quantidade || 1))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {temMais && (
        <button
          onClick={() => setExpandido(!expandido)}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          {expandido ? '↑ Ver menos' : `↓ Ver mais ${itens.length - LIMITE_VISIVEL} itens`}
        </button>
      )}
    </div>
  )
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [itensPedido, setItensPedido] = useState<any[]>([])
  const [motoboys, setMotoboys] = useState<any[]>([])
  const [novosPedidosCount, setNovosPedidosCount] = useState(0)
  const [somAtivado, setSomAtivado] = useState(true)
  const [detalhesExpandidos, setDetalhesExpandidos] = useState<Set<string>>(new Set())
  const [filtroStatus, setFiltroStatus] = useState<string | null>('novo') // Padrão: novo
  const [filtroData, setFiltroData] = useState<string>(new Date().toISOString().split('T')[0]) // Data atual como padrão
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [pedidoEditando, setPedidoEditando] = useState<any>(null)
  const [itensEditando, setItensEditando] = useState<any[]>([])
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [tenantIdAtual, setTenantIdAtual] = useState<string>('')
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false)
  const [pedidoCancelando, setPedidoCancelando] = useState<any>(null)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoDetalhe, setMotivoDetalhe] = useState('')
  const [salvandoCancelamento, setSalvandoCancelamento] = useState(false)
  const supabase = createClient()
  const { inicializarIds, adicionarAoLoop, removerDoLoop, verificarMudancaStatus } = useSomNovoPedido(somAtivado)

  useEffect(() => {
    let subscription: any = null

    const setupRealtime = async () => {
      const tenantId = await activeTenantId()
      if (!tenantId) { setLoading(false); return }
      setTenantIdAtual(tenantId)

      // 1. Carrega pedidos iniciais (excluir apagados)
      const { data } = await supabase
        .from('pedidos')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
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
              // Filtrar pedidos apagados
              const filtrados = prev.filter(p => !p.deleted_at)
              if (filtrados.some(p => p.id === novoPedido.id)) return filtrados
              const novosPedidos = [novoPedido, ...filtrados]
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
              // Se foi apagado, remover da lista
              if (atualizado.deleted_at) {
                return prev.filter(p => p.id !== atualizado.id)
              }
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

  const updateStatus = async (pedido: Pedido, newStatus: PedidoStatus, motivo?: { tipo: string; descricao?: string }) => {
    // Remove do loop de som se estiver mudando de "novo"
    if (pedido.status === 'novo') {
      removerDoLoop(pedido.id)
    }

    const updates: any = {
      status: newStatus,
      data_atualizacao: new Date().toISOString()
    }

    // Se for cancelamento, salva motivo
    if (newStatus === 'cancelado' && motivo) {
      updates.motivo_cancelamento = motivo.tipo
      updates.motivo_cancelamento_detalhe = motivo.descricao || null
      updates.cancelado_por = 'lojista'
      updates.cancelado_em = new Date().toISOString()
    }

    // Obter tenantId se disponível
    const tid = await activeTenantId()

    try {
      let query = supabase
        .from('pedidos')
        .update(updates)
        .eq('id', pedido.id)

      // Se tiver tenantId, filtrar por ele para segurança
      if (tid) {
        query = query.eq('tenant_id', tid)
      }

      const { error } = await query

      if (error) {
        console.error('Erro ao atualizar status:', error)
        alert('Erro ao atualizar status: ' + (error.message || 'Erro desconhecido'))
      } else {
        loadPedidos()
      }
    } catch (err: any) {
      console.error('Erro completo ao atualizar status:', err)
      alert('Erro ao atualizar status: ' + (err.message || 'Erro desconhecido'))
    }
  }

  // Toggle pago/nao pago via API
  const togglePago = async (pedido: any) => {
    const novoStatus = !pedido.pago
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/pago`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pedido_id: pedido.id, pago: novoStatus })
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Erro ao marcar pago:', data.error)
        alert('Erro ao marcar como pago: ' + (data.error || 'Erro desconhecido'))
      } else {
        loadPedidos()
      }
    } catch (err) {
      console.error('Erro ao marcar pago:', err)
      alert('Erro ao marcar como pago')
    }
  }

  // Modal de cancelamento
  const abrirModalCancelamento = (pedido: any) => {
    setPedidoCancelando(pedido)
    setMotivoSelecionado('')
    setMotivoDetalhe('')
    setModalCancelarAberto(true)
  }

  const confirmarCancelamento = async () => {
    if (!pedidoCancelando) return
    if (!motivoSelecionado) {
      alert('Selecione um motivo para o cancelamento')
      return
    }
    if (motivoSelecionado === 'outro' && !motivoDetalhe.trim()) {
      alert('Descreva o motivo do cancelamento')
      return
    }

    setSalvandoCancelamento(true)
    await updateStatus(pedidoCancelando, 'cancelado', {
      tipo: motivoSelecionado,
      descricao: motivoDetalhe.trim() || undefined
    })
    setSalvandoCancelamento(false)
    setModalCancelarAberto(false)
    setPedidoCancelando(null)
    setMotivoSelecionado('')
    setMotivoDetalhe('')
  }

  // Confirmar pedido via WPP (envia msg ao cliente)
  const confirmarPedidoWPP = (pedido: any) => {
    const mensagem = gerarMensagemWhatsApp({
      pedidoId: pedido.id,
      pedidoCodigo: pedido.codigo || null,
      tenantNome: 'Nossa Loja', // Será substituído depois pelo tenant real
      clienteNome: pedido.cliente_nome || '',
      clienteWhatsapp: pedido.cliente_whatsapp || '',
      itens: itensCache[pedido.id] || [],
      subtotal: pedido.valor_subtotal || (pedido.valor_total - (pedido.taxa_entrega || 0)),
      taxaEntrega: pedido.taxa_entrega || 0,
      desconto: pedido.valor_desconto || 0,
      total: pedido.valor_total,
      formaPagamento: Array.isArray(pedido.forma_pagamento) ? pedido.forma_pagamento[0] : pedido.forma_pagamento,
      trocoPara: pedido.troco_para,
      endereco: pedido.endereco_entrega || '',
      numero: pedido.numero_entrega || '',
      complemento: pedido.complemento_entrega,
      bairro: pedido.bairro_entrega || '',
      observacoes: pedido.observacoes || '',
      tipoEntrega: pedido.tipo_entrega || 'delivery',
    })
    const fone = (pedido.cliente_whatsapp || '').replace(/\D/g, '')
    window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(mensagem)}`, '_blank')
  }

  // Imprimir pedido
  const imprimirPedido = async (pedido: any) => {
    const janela = window.open('', '_blank', 'width=400,height=600')
    if (!janela) return alert('Permita popups para imprimir')

    // Buscar itens com complementos do cache
    const itensDoPedido = itensCache[pedido.id] || []

    // Gerar HTML dos itens com complementos
    const itensHtml = itensDoPedido.map((i: any) => {
      const comps = Array.isArray(i.complementos)
        ? (typeof i.complementos === 'string' ? JSON.parse(i.complementos) : i.complementos)
        : []

      let html = `<tr><td><strong>${i.quantidade}x ${i.nome}</strong>`
      if (i.variante_nome) html += ` (${i.variante_nome})`
      html += `</td><td style="text-align:right">R$ ${(i.valor_unitario * i.quantidade).toFixed(2)}</td></tr>`

      // Complementos
      comps.forEach((c: any) => {
        const compValor = (c.valor || 0) * (c.quantidade || 1)
        html += `<tr><td style="padding-left:15px;color:#666;font-size:11px">+ ${c.quantidade > 1 ? `${c.quantidade}x ` : ''}${c.nome}</td><td style="text-align:right;color:#666;font-size:11px">R$ ${compValor.toFixed(2)}</td></tr>`
      })

      return html
    }).join('')

    janela.document.write(`
      <html><head><title>Pedido ${pedido.codigo || pedido.id}</title>
      <style>
        body{font-family:monospace;font-size:13px;padding:15px;max-width:380px;margin:0 auto}
        h1{font-size:16px;margin:0 0 10px;border-bottom:2px solid #000;padding-bottom:5px}
        h2{font-size:12px;margin:10px 0 5px;color:#333}
        p{margin:3px 0;font-size:12px}
        table{width:100%;border-collapse:collapse;margin:5px 0}
        td{padding:3px 0;border-bottom:1px dashed #ddd;font-size:12px}
        hr{border:none;border-top:1px dashed #000;margin:10px 0}
        .total{font-weight:bold;font-size:16px;margin-top:10px}
        .info-section{margin-bottom:10px}
      </style>
      </head><body>
      <h1>📋 PEDIDO ${pedido.codigo || pedido.id}</h1>

      <div class="info-section">
        <h2>👤 CLIENTE</h2>
        <p><strong>${pedido.cliente_nome || 'Cliente'}</strong></p>
        <p>📱 ${pedido.cliente_whatsapp || '-'}</p>
      </div>

      <div class="info-section">
        <h2>📍 ENDEREÇO</h2>
        ${pedido.tipo_entrega === 'retirada'
          ? '<p>🏪 Retirada no local</p>'
          : `<p>${pedido.endereco_entrega || '-'}, ${pedido.numero_entrega || 's/n'}</p>
             <p>${pedido.bairro_entrega || ''} ${pedido.complemento_entrega ? `(${pedido.complemento_entrega})` : ''}</p>`
        }
      </div>

      <hr>
      <h2>🛒 ITENS DO PEDIDO</h2>
      <table>${itensHtml}</table>
      <hr>

      <div>
        <p><strong>Subtotal:</strong> R$ ${(pedido.valor_subtotal || 0).toFixed(2)}</p>
        ${pedido.valor_desconto > 0 ? `<p style="color:green"><strong>Desconto:</strong> -R$ ${(pedido.valor_desconto || 0).toFixed(2)}</p>` : ''}
        ${pedido.taxa_entrega > 0 ? `<p><strong>Entrega:</strong> R$ ${(pedido.taxa_entrega || 0).toFixed(2)}</p>` : ''}
        <p class="total">TOTAL: R$ ${(pedido.valor_total || 0).toFixed(2)}</p>
      </div>

      <hr>
      <div>
        <p><strong>💳 Pagamento:</strong> ${Array.isArray(pedido.forma_pagamento) ? pedido.forma_pagamento.join(', ') : (pedido.forma_pagamento || '-')}</p>
        ${pedido.tipo_entrega === 'delivery' && pedido.forma_pagamento === 'dinheiro' && pedido.troco_para > 0
          ? `<p><strong>Troco para:</strong> R$ ${(pedido.troco_para || 0).toFixed(2)}</p>`
          : ''}
      </div>

      ${pedido.observacoes ? `
      <hr>
      <div>
        <p><strong>📝 Observações:</strong></p>
        <p style="background:#fffde7;padding:5px;border-radius:3px">${pedido.observacoes}</p>
      </div>
      ` : ''}

      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `)
  }

  // Dar desconto
  const [showDescontoModal, setShowDescontoModal] = useState(false)
  const [pedidoDesconto, setPedidoDesconto] = useState<any>(null)
  const [valorDesconto, setValorDesconto] = useState('')
  const [tipoDesconto, setTipoDesconto] = useState<'valor' | 'percentual'>('valor')

  const abrirModalDesconto = (pedido: any) => {
    setPedidoDesconto(pedido)
    setValorDesconto(String(pedido.valor_desconto || 0))
    setTipoDesconto('valor')
    setShowDescontoModal(true)
  }

  const aplicarDesconto = async () => {
    if (!pedidoDesconto) return
    const descontoNum = parseFloat(valorDesconto) || 0
    let novoDesconto = 0

    if (tipoDesconto === 'valor') {
      novoDesconto = descontoNum
    } else {
      // Percentual
      novoDesconto = (pedidoDesconto.valor_subtotal || pedidoDesconto.valor_total) * (descontoNum / 100)
    }

    const novoTotal = (pedidoDesconto.valor_total + (pedidoDesconto.valor_desconto || 0)) - novoDesconto

    try {
      const res = await fetch(`/api/pedidos/${pedidoDesconto.id}/desconto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          valor_desconto: Math.round(novoDesconto * 100) / 100,
          valor_total: Math.max(0, Math.round(novoTotal * 100) / 100)
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erro ao aplicar desconto')
      } else {
        setShowDescontoModal(false)
        loadPedidos()
        // Atualizar o pedido selecionado se o modal de detalhes estiver aberto
        if (selectedPedido && selectedPedido.id === pedidoDesconto.id) {
          const pedidoAtualizado = { ...selectedPedido, valor_desconto: Math.round(novoDesconto * 100) / 100, valor_total: Math.max(0, Math.round(novoTotal * 100) / 100) }
          setSelectedPedido(pedidoAtualizado)
        }
      }
    } catch (err) {
      alert('Erro ao aplicar desconto')
    }
  }

  // Apagar pedido cancelado
  const apagarPedido = async (pedido: any) => {
    if (!confirm(`Apagar o pedido ${pedido.codigo || '#' + pedido.id.slice(0,8)}?\n\nEsta ação não pode ser desfeita.\nO registro será mantido apenas para auditoria do admin.`)) return

    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/apagar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erro ao apagar pedido')
      } else {
        loadPedidos()
      }
    } catch (err) {
      alert('Erro ao apagar pedido')
    }
  }

  // Editar pedido - abre modal real
  const abrirModalEditar = (pedido: any) => {
    setPedidoEditando(pedido)
    setModalEditarAberto(true)
  }

  const salvarEdicao = async () => {
    if (!pedidoEditando) return
    setSalvandoEdicao(true)
    try {
      const body = {
        cliente_nome: pedidoEditando.cliente_nome,
        cliente_whatsapp: pedidoEditando.cliente_whatsapp,
        endereco_entrega: pedidoEditando.endereco_entrega,
        numero_entrega: pedidoEditando.numero_entrega,
        complemento_entrega: pedidoEditando.complemento_entrega,
        bairro_entrega: pedidoEditando.bairro_entrega,
        observacoes: pedidoEditando.observacoes,
        taxa_entrega: Number(pedidoEditando.taxa_entrega) || 0,
        valor_desconto: Number(pedidoEditando.valor_desconto) || 0,
        itens: itensEditando,
      }
      const r = await fetch(`/api/pedidos/${pedidoEditando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'Erro ao salvar')
      }
      alert('Pedido atualizado!')
      setModalEditarAberto(false)
      setPedidoEditando(null)
      setItensEditando([])
      loadPedidos()
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  // Cache de itens por pedido (carrega sob demanda)
  const [itensCache, setItensCache] = useState<Record<string, any[]>>({})
  useEffect(() => {
    const carregarItensCache = async () => {
      const cache: Record<string, any[]> = {}
      for (const p of pedidos) {
        const { data } = await supabase.from('pedido_itens').select('*').eq('pedido_id', p.id)
        cache[p.id] = data || []
      }
      setItensCache(cache)
    }
    carregarItensCache()
  }, [pedidos])

  // Carrega itens quando modal de edição abre
  useEffect(() => {
    if (modalEditarAberto && pedidoEditando) {
      setItensEditando(itensCache[pedidoEditando.id] || [])
    }
  }, [modalEditarAberto, pedidoEditando, itensCache])

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

      {/* Filtro de Data */}
      <div className="flex items-center gap-3 mb-4 bg-white p-3 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">📅 Filtrar por data:</label>
          <input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="form-input text-sm px-3 py-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltroData(new Date(Date.now() - 86400000).toISOString().split('T')[0])}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Ontem
          </button>
          <button
            onClick={() => setFiltroData(new Date().toISOString().split('T')[0])}
            className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => { setFiltroData(''); setFiltroStatus('em_aberto'); }}
            className={`px-2 py-1 text-xs rounded transition-colors ${!filtroData && filtroStatus === 'em_aberto' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            🟣 Em aberto
          </button>
        </div>
      </div>

      {/* Stats Bar - BOTOES PEQUENOS E CLICAVEIS */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* Em Aberto - todos pendentes sem limite de data */}
        {(() => {
          const STATUS_EM_ABERTO = ['novo', 'preparando', 'pronto', 'saiu']
          const count = pedidos.filter((p) => STATUS_EM_ABERTO.includes(p.status)).length
          const isActive = filtroStatus === 'em_aberto'
          return (
            <button
              key="em_aberto"
              onClick={() => setFiltroStatus(isActive ? null : 'em_aberto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${isActive ? 'bg-purple-100 text-purple-700 shadow-md border-purple-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Clock className="w-3 h-3" />
              <span>Em aberto</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${isActive ? 'bg-white/30' : 'bg-gray-100'}`}>{count}</span>
            </button>
          )
        })()}

        {STATUS_LISTA.filter(s => s !== 'cancelado').map((status) => {
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

        {/* Cancelado - sempre por último */}
        {(() => {
          const status = 'cancelado'
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
        })()}
      </div>

      {/* Pedidos filtrados ou todos */}
      {(() => {
        // Status "em_aberto" = novo + preparando + pronto + saiu (sem data)
        const STATUS_EM_ABERTO = ['novo', 'preparando', 'pronto', 'saiu']

        let pedidosFiltrados = pedidos

        // Filtro de status
        if (filtroStatus === 'em_aberto') {
          pedidosFiltrados = pedidos.filter(p => STATUS_EM_ABERTO.includes(p.status))
        } else if (filtroStatus) {
          pedidosFiltrados = pedidos.filter(p => p.status === filtroStatus)
        }
        // Se filtroStatus é null, mostra todos os pedidos

        // Aplicar filtro de data APENAS se não for "em_aberto" e se filtroData estiver definido
        const pedidosPorData = (filtroStatus === 'em_aberto' || !filtroData)
          ? pedidosFiltrados
          : pedidosFiltrados.filter(p => {
              const dataPedido = new Date(p.data_criacao).toISOString().split('T')[0]
              return dataPedido === filtroData
            })

        const statusConfig = filtroStatus && filtroStatus !== 'em_aberto' ? STATUS_CONFIG[filtroStatus as PedidoStatus] : null
        return (
          <>
            {filtroStatus && (
              <div className="mb-4 text-sm text-gray-500">
                Mostrando <strong>{filtroStatus === 'em_aberto' ? 'Em aberto (todos)' : statusConfig?.label}</strong> ({pedidosPorData.length} pedido{pedidosPorData.length !== 1 ? 's' : ''})
                <button onClick={() => { setFiltroStatus(null); setFiltroData(new Date().toISOString().split('T')[0]); }} className="ml-2 text-blue-600 hover:underline">Limpar filtro</button>
              </div>
            )}

            {filtroData && (
              <div className="mb-4 text-sm text-gray-500">
                📅 Data: <strong>{new Date(filtroData + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> — {pedidosPorData.length} pedido{pedidosPorData.length !== 1 ? 's' : ''}
              </div>
            )}

      {/* Lista de Pedidos em GRID 3 COLUNAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {pedidosPorData.length > 0 ? (
          pedidosPorData.map((pedido) => {
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
                  {((pedido as any).tipo_entrega !== 'retirada') && (pedido as any).complemento_entrega && (
                    <p className="text-gray-500 italic text-xs">└ {(pedido as any).complemento_entrega}</p>
                  )}
                </div>

                {/* ITENS */}
                <ItensPedido pedidoId={pedido.id} compacto />

                {/* OBS */}
                {(pedido as any).observacoes && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs text-amber-800 truncate">📝 {(pedido as any).observacoes}</p>
                  </div>
                )}

                {/* TEMPO ALERTA */}
                {pedido.status !== 'entregue' && pedido.status !== 'cancelado' && (
                  <div className="px-3 py-2 border-t">
                    <TempoAlerta
                      dataCriacao={pedido.data_criacao}
                      tempoEstimadoMin={(pedido as any).tempo_estimado_min}
                    />
                  </div>
                )}

                {/* TOTAIS + AÇÕES */}
                <div className="mt-auto p-3 bg-gray-50 border-t border-gray-200">
                  {/* Totais simplificados */}
                  <div className="flex justify-between items-center text-sm mb-3">
                    <div className="text-gray-600">
                      <span className="text-xs">{formatFormaPagamento((pedido as any).forma_pagamento)}</span>
                    </div>
                    <span className="font-bold text-green-600">{formatCurrency(pedido.valor_total)}</span>
                  </div>

                  {/* LINHA 1: Avançar status (GRANDE) */}
                  {nextStatus && (
                    <button
                      onClick={() => updateStatus(pedido, nextStatus)}
                      className="w-full px-4 py-3 mb-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                      title={`Avançar para ${STATUS_CONFIG[nextStatus].label}`}
                    >
                      <ChevronRight className="w-5 h-5" />
                      AVANÇAR PARA {STATUS_CONFIG[nextStatus].label.toUpperCase()}
                    </button>
                  )}

                  {/* LINHA 2: Botões de ação (grid 2 colunas x 3 linhas) */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Pago */}
                    <button
                      onClick={() => togglePago(pedido)}
                      className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                        (pedido as any).pago
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300'
                      }`}
                      title={(pedido as any).pago ? 'Pago - clique para desmarcar' : 'Marcar como pago'}
                    >
                      <Check className="w-5 h-5" />
                      {(pedido as any).pago ? '✓ Pago' : 'Pago'}
                    </button>

                    {/* Desconto */}
                    <button
                      onClick={() => abrirModalDesconto(pedido)}
                      className="flex items-center justify-center gap-2 px-3 py-3 bg-amber-100 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-200 border-2 border-amber-300 transition-all active:scale-95"
                      title="Dar desconto"
                    >
                      <Percent className="w-5 h-5" />
                      Desconto
                    </button>

                    {/* WhatsApp */}
                    <button
                      onClick={() => confirmarPedidoWPP(pedido)}
                      className="flex items-center justify-center gap-2 px-3 py-3 bg-green-100 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-200 border-2 border-green-300 transition-all active:scale-95"
                      title="Confirmar pedido (WhatsApp)"
                    >
                      <MessageCircle className="w-5 h-5" />
                      WhatsApp
                    </button>

                    {/* Editar */}
                    <button
                      onClick={() => abrirModalEditar(pedido)}
                      className="flex items-center justify-center gap-2 px-3 py-3 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-200 border-2 border-indigo-300 transition-all active:scale-95"
                      title="Editar pedido"
                    >
                      <Pencil className="w-5 h-5" />
                      Editar
                    </button>

                    {/* Imprimir */}
                    <button
                      onClick={() => imprimirPedido(pedido)}
                      className="flex items-center justify-center gap-2 px-3 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 border-2 border-gray-300 transition-all active:scale-95"
                      title="Imprimir pedido"
                    >
                      <Printer className="w-5 h-5" />
                      Imprimir
                    </button>

                    {/* Cancelar ou Apagar */}
                    {pedido.status === 'cancelado' ? (
                      <button
                        onClick={() => apagarPedido(pedido)}
                        className="flex items-center justify-center gap-2 px-3 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-red-100 hover:text-red-700 border-2 border-gray-300 transition-all active:scale-95"
                        title="Apagar pedido (somente cancelados)"
                      >
                        <Trash2 className="w-5 h-5" />
                        Apagar
                      </button>
                    ) : (
                      <button
                        onClick={() => abrirModalCancelamento(pedido)}
                        className="flex items-center justify-center gap-2 px-3 py-3 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 border-2 border-red-300 transition-all active:scale-95"
                        title="Cancelar pedido"
                      >
                        <X className="w-5 h-5" />
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-full bg-white rounded-xl border p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido</h3>
            <p className="hint">Os pedidos aparecerão aqui quando chegarem</p>
          </div>
        )}
      </div>
          </>
        )
      })()}

      {/* Modal de Detalhes Completos */}
      {selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">Pedido {(selectedPedido as any).codigo || ('#' + selectedPedido.id.slice(0, 8))}</h2>
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

              {/* Avaliação - só aparece quando pedido está entregue */}
              {selectedPedido.status === 'entregue' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
                  <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Avaliação do Cliente
                  </h3>
                  <p className="text-sm text-green-700 mb-3">
                    Envie um convite para o cliente avaliar sua experiência
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      className="flex-1 px-3 py-2 bg-white border border-green-300 text-green-700 text-sm rounded-lg hover:bg-green-100 flex items-center justify-center gap-2"
                      onClick={() => gerarConviteAvaliacao(selectedPedido.id)}
                    >
                      <Copy className="w-4 h-4" />
                      Copiar link
                    </button>
                    {(selectedPedido as any).cliente_whatsapp && (
                      <button
                        type="button"
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                        onClick={async () => {
                          // Gerar o convite
                          const response = await fetch(`/api/pedidos/${encodeURIComponent(selectedPedido.id)}/avaliacao-convite`, { method: 'POST' })
                          const body = await response.json()
                          if (!response.ok) return alert(body.error || 'Erro ao gerar convite')

                          const link = `${window.location.origin}/avaliar/${body.token}`
                          const fone = ((selectedPedido as any).cliente_whatsapp || '').replace(/\D/g, '')

                          // Gerar mensagem de avaliação
                          const { gerarMensagemAvaliacao } = await import('@/lib/whatsapp/template')
                          const msg = gerarMensagemAvaliacao({
                            tenantNome: 'Nossa Loja',
                            codigo: selectedPedido.codigo || selectedPedido.id.slice(0, 8),
                            linkAvaliacao: link
                          })

                          window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank')
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar via WhatsApp
                      </button>
                    )}
                  </div>
                </div>
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

      {/* MODAL DE DESCONTO */}
      {showDescontoModal && pedidoDesconto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Aplicar Desconto</h2>
              <button onClick={() => setShowDescontoModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Pedido: <strong>{pedidoDesconto.codigo || '#' + pedidoDesconto.id.slice(0, 8)}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Subtotal atual: <strong>{formatCurrency(pedidoDesconto.valor_subtotal || pedidoDesconto.valor_total)}</strong>
            </p>

            {/* Tipo de desconto */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Tipo de desconto</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTipoDesconto('valor')}
                  className={`p-3 rounded-xl border-2 font-medium transition ${
                    tipoDesconto === 'valor' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  Valor (R$)
                </button>
                <button
                  onClick={() => setTipoDesconto('percentual')}
                  className={`p-3 rounded-xl border-2 font-medium transition ${
                    tipoDesconto === 'percentual' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  Percentual (%)
                </button>
              </div>
            </div>

            {/* Valor */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {tipoDesconto === 'valor' ? 'Valor do desconto (R$)' : 'Percentual de desconto (%)'}
              </label>
              <input
                type="number"
                step={tipoDesconto === 'valor' ? '0.01' : '0.1'}
                value={valorDesconto}
                onChange={(e) => setValorDesconto(e.target.value)}
                placeholder={tipoDesconto === 'valor' ? '0,00' : '0'}
                className="form-input w-full text-xl"
                autoFocus
              />
            </div>

            {/* Preview */}
            {(() => {
              const valor = parseFloat(valorDesconto) || 0
              const desconto = tipoDesconto === 'valor'
                ? valor
                : (pedidoDesconto.valor_subtotal || pedidoDesconto.valor_total) * (valor / 100)
              const novoTotal = Math.max(0, (pedidoDesconto.valor_total + (pedidoDesconto.valor_desconto || 0)) - desconto)
              return (
                <div className="mb-4 p-4 bg-green-50 rounded-xl">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Desconto:</span>
                    <span className="font-bold text-red-600">-{formatCurrency(desconto)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Novo total:</span>
                    <span className="text-green-600">{formatCurrency(novoTotal)}</span>
                  </div>
                </div>
              )
            })()}

            <div className="flex gap-3">
              <button onClick={() => setShowDescontoModal(false)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button onClick={aplicarDesconto} className="btn-primary flex-1 justify-center">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO */}
      {modalCancelarAberto && pedidoCancelando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-red-50 border-b border-red-200">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-900">Cancelar pedido?</h2>
                  <p className="text-sm text-red-700">
                    {pedidoCancelando.codigo || `#${pedidoCancelando.id.slice(0, 8)}`} - {pedidoCancelando.cliente_nome || 'Cliente'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  ⚠️ Tem certeza que deseja cancelar este pedido?
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Esta ação não pode ser desfeita. O pedido não será mais processado.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Motivo do cancelamento *
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'cliente_desistiu', label: 'Cliente desistiu do pedido' },
                    { id: 'nao_conseguimos_atender', label: 'Não conseguimos atender' },
                    { id: 'fora_area_entrega', label: 'Fora da área de entrega' },
                    { id: 'cliente_nao_respondeu', label: 'Cliente não respondeu' },
                    { id: 'pagamento_recusado', label: 'Pagamento recusado' },
                    { id: 'produto_indisponivel', label: 'Produto indisponível' },
                    { id: 'erro_pedido', label: 'Erro no pedido (lojista)' },
                    { id: 'outro', label: 'Outro motivo' },
                  ].map((op) => (
                    <label key={op.id} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                      style={{ borderColor: motivoSelecionado === op.id ? 'var(--green)' : '#E5E7EB', background: motivoSelecionado === op.id ? 'rgba(22,163,74,.06)' : 'transparent' }}>
                      <input
                        type="radio"
                        name="motivo"
                        checked={motivoSelecionado === op.id}
                        onChange={() => setMotivoSelecionado(op.id)}
                        className="size-4"
                      />
                      <span className="text-sm">{op.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(motivoSelecionado === 'outro' || motivoSelecionado) && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Detalhes {motivoSelecionado === 'outro' ? '*' : '(opcional)'}
                  </label>
                  <textarea
                    className="form-input w-full"
                    rows={3}
                    value={motivoDetalhe}
                    onChange={(e) => setMotivoDetalhe(e.target.value)}
                    placeholder="Descreva o motivo do cancelamento..."
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setModalCancelarAberto(false)
                  setPedidoCancelando(null)
                  setMotivoSelecionado('')
                  setMotivoDetalhe('')
                }}
                className="px-4 py-2 border rounded-lg text-sm"
                disabled={salvandoCancelamento}
              >
                Voltar
              </button>
              <button
                onClick={confirmarCancelamento}
                disabled={salvandoCancelamento || !motivoSelecionado}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                {salvandoCancelamento ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {modalEditarAberto && pedidoEditando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
              <h2 className="text-xl font-bold">Editar pedido {pedidoEditando.codigo || pedidoEditando.id.slice(0, 8)}</h2>
              <button onClick={() => setModalEditarAberto(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* BLOCO 1: DADOS DO CLIENTE */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <span>👤</span> Dados do Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="font-medium block mb-1">Nome</span>
                    <input
                      className="form-input w-full"
                      value={pedidoEditando.cliente_nome || ''}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, cliente_nome: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium block mb-1">WhatsApp</span>
                    <input
                      className="form-input w-full"
                      value={pedidoEditando.cliente_whatsapp || ''}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, cliente_whatsapp: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* BLOCO 2: ENDEREÇO DE ENTREGA */}
              <div className="bg-green-50 rounded-xl p-4">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <span>📍</span> Endereço de Entrega
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-sm md:col-span-2">
                    <span className="font-medium block mb-1">Endereço</span>
                    <input
                      className="form-input w-full"
                      value={pedidoEditando.endereco_entrega || ''}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, endereco_entrega: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium block mb-1">Número</span>
                    <input
                      className="form-input w-full"
                      value={pedidoEditando.numero_entrega || ''}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, numero_entrega: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium block mb-1">Bairro</span>
                    <input
                      className="form-input w-full"
                      value={pedidoEditando.bairro_entrega || ''}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, bairro_entrega: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium block mb-1">Complemento</span>
                    <input
                      className="form-input w-full"
                      value={pedidoEditando.complemento_entrega || ''}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, complemento_entrega: e.target.value })}
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="font-medium block mb-1">Observações</span>
                    <textarea
                      className="form-input w-full"
                      rows={2}
                      value={pedidoEditando.observacoes || ''}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, observacoes: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* BLOCO 3: VALORES */}
              <div className="bg-yellow-50 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                  <span>💰</span> Valores
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="font-medium block mb-1">Taxa de entrega (R$)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input w-full"
                      value={pedidoEditando.taxa_entrega || 0}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, taxa_entrega: Number(e.target.value) })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium block mb-1">Desconto (R$)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input w-full"
                      value={pedidoEditando.valor_desconto || 0}
                      onChange={e => setPedidoEditando({ ...pedidoEditando, valor_desconto: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </div>

              {/* BLOCO 4: ITENS */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Itens do pedido</h3>
                  <button
                    onClick={() => {
                      const novoItem = { produto_id: '', nome: '', quantidade: 1, valor_unitario: 0, complementos: [] }
                      setItensEditando([...itensEditando, novoItem])
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar item
                  </button>
                </div>

                <div className="space-y-2">
                  {itensEditando.map((item, idx) => (
                    <ItemEditor
                      key={idx}
                      item={item}
                      idx={idx}
                      tenantId={tenantIdAtual}
                      onChange={(i, novo) => {
                        const novos = [...itensEditando]
                        novos[i] = novo
                        setItensEditando(novos)
                      }}
                      onRemove={(i) => {
                        const novos = itensEditando.filter((_, ix) => ix !== i)
                        setItensEditando(novos)
                      }}
                    />
                  ))}
                </div>

                {/* TOTAL */}
                <div className="mt-3 pt-3 border-t">
                  {(() => {
                    const subtotal = itensEditando.reduce((acc, i) => {
                      const compTotal = (Array.isArray(i.complementos)
                        ? (typeof i.complementos === 'string' ? JSON.parse(i.complementos) : i.complementos)
                        : []
                      ).reduce((s: number, c: any) => s + (Number(c.valor) || 0) * (Number(c.quantidade) || 1), 0)
                      return acc + ((Number(i.valor_unitario) || 0) + compTotal) * (Number(i.quantidade) || 1)
                    }, 0)
                    const taxa = Number(pedidoEditando.taxa_entrega) || 0
                    const desconto = Number(pedidoEditando.valor_desconto) || 0
                    const total = Math.max(0, subtotal + taxa - desconto)
                    return (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
                        {taxa > 0 && <div className="flex justify-between"><span>Taxa:</span><span>{formatCurrency(taxa)}</span></div>}
                        {desconto > 0 && <div className="flex justify-between text-green-600"><span>Desconto:</span><span>-{formatCurrency(desconto)}</span></div>}
                        <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>TOTAL:</span><span className="text-green-600">{formatCurrency(total)}</span></div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="p-4 border-t sticky bottom-0 bg-white flex justify-end gap-2">
              <button
                onClick={() => setModalEditarAberto(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={salvandoEdicao}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
