'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Clock, Check, Truck, X, Eye, ChevronRight, Plus, MessageCircle, ChevronDown, ChevronUp, Printer, Tag, Pencil } from 'lucide-react'
import { Pedido, PedidoStatus } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { activeTenantId } from '@/lib/active-tenant-client'
import { gerarMensagemWhatsApp } from '@/lib/whatsapp/template'

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

// Status que devem aparecer na barra de estatísticas (exclui 'todos' que é calculado)
const STATUS_LISTA: PedidoStatus[] = ['novo', 'preparando', 'pronto', 'saiu', 'entregue', 'cancelado']

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
                <div className="ml-2 text-gray-500 text-[10px]">
                  {comps.map((c: any, i: number) => (
                    <span key={i} className="mr-1">+ {c.nome}{c.quantidade > 1 ? `x${c.quantidade}` : ''}</span>
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
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null) // null = todos
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

  // Confirmar pedido via WPP (envia msg ao cliente)
  const confirmarPedidoWPP = (pedido: any) => {
    const mensagem = gerarMensagemWhatsApp({
      pedidoId: pedido.codigo || pedido.id,
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
  const imprimirPedido = (pedido: any) => {
    const janela = window.open('', '_blank', 'width=400,height=600')
    if (!janela) return alert('Permita popups para imprimir')
    const itensHtml = (itensCache[pedido.id] || []).map(i => `<tr><td>${i.quantidade}x ${i.nome}</td><td>R$ ${(i.valor_unitario * i.quantidade).toFixed(2)}</td></tr>`).join('')
    janela.document.write(`
      <html><head><title>Pedido ${pedido.codigo || pedido.id}</title>
      <style>body{font-family:monospace;font-size:12px;padding:10px}h1{font-size:14px}table{width:100%;border-collapse:collapse}td{padding:2px 0;border-bottom:1px dashed #ccc}hr{border:none;border-top:1px dashed #000}.total{font-weight:bold;font-size:14px}</style>
      </head><body>
      <h1>Pedido: ${pedido.codigo || pedido.id}</h1>
      <p>${pedido.cliente_nome || ''}<br>${pedido.cliente_whatsapp || ''}<br>${pedido.endereco_entrega || ''} ${pedido.numero_entrega || ''}<br>${pedido.bairro_entrega || ''}</p>
      <hr><table>${itensHtml}</table>
      <hr>
      <p>Subtotal: R$ ${(pedido.valor_subtotal || 0).toFixed(2)}<br>
      Desconto: R$ ${(pedido.valor_desconto || 0).toFixed(2)}<br>
      Entrega: R$ ${(pedido.taxa_entrega || 0).toFixed(2)}</p>
      <p class="total">TOTAL: R$ ${(pedido.valor_total || 0).toFixed(2)}</p>
      <p>Pagamento: ${pedido.forma_pagamento}</p>
      ${pedido.observacoes ? `<p>Obs: ${pedido.observacoes}</p>` : ''}
      <script>window.print();window.close();</script>
      </body></html>
    `)
  }

  // Dar desconto
  const abrirModalDesconto = (pedido: any) => {
    const valor = prompt(`Desconto em R$ (valor atual: R$ ${(pedido.valor_desconto || 0).toFixed(2)})`, String(pedido.valor_desconto || 0))
    if (valor === null) return
    const novoDesconto = parseFloat(valor) || 0
    const novoTotal = (pedido.valor_total + (pedido.valor_desconto || 0)) - novoDesconto
    supabase.from('pedidos').update({
      valor_desconto: novoDesconto,
      valor_total: novoTotal
    }).eq('id', pedido.id).then(({ error }) => {
      if (error) alert('Erro ao aplicar desconto')
      else loadPedidos()
    })
  }

  // Editar pedido (placeholder - redireciona para modal custom)
  const abrirModalEditar = (pedido: any) => {
    alert(`Editar pedido ${pedido.codigo || pedido.id} - Funcionalidade será implementada em próxima sprint. Por enquanto, cancele e recrie.`)
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

      {/* Stats Bar - BOTOES PEQUENOS E CLICAVEIS */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* Card "Todos" - mostra total */}
        <button
          onClick={() => setFiltroStatus(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            filtroStatus === null
              ? 'bg-gray-800 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>Todos</span>
          <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-bold">{pedidos.length}</span>
        </button>

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

      {/* Pedidos filtrados ou todos */}
      {(() => {
        const pedidosFiltrados = filtroStatus
          ? pedidos.filter(p => p.status === filtroStatus)
          : pedidos
        const statusConfig = filtroStatus ? STATUS_CONFIG[filtroStatus as PedidoStatus] : null
        return (
          <>
            {filtroStatus && (
              <div className="mb-4 text-sm text-gray-500">
                Mostrando <strong>{statusConfig?.label}</strong> ({pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''})
                <button onClick={() => setFiltroStatus(null)} className="ml-2 text-blue-600 hover:underline">Limpar filtro</button>
              </div>
            )}

      {/* Lista de Pedidos em GRID 3 COLUNAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {pedidosFiltrados.length > 0 ? (
          pedidosFiltrados.map((pedido) => {
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

                {/* TOTAIS + AÇÕES */}
                <div className="mt-auto p-3 bg-gray-50 border-t border-gray-200">
                  <div className="space-y-0.5 text-xs mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>{formatCurrency((pedido as any).valor_subtotal || ((pedido as any).valor_total - ((pedido as any).taxa_entrega || 0)))}</span>
                    </div>
                    {((pedido as any).valor_desconto > 0) && (
                      <div className="flex justify-between text-green-600">
                        <span>Desconto:</span>
                        <span>-{formatCurrency((pedido as any).valor_desconto)}</span>
                      </div>
                    )}
                    {((pedido as any).taxa_entrega > 0) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Entrega:</span>
                        <span>{formatCurrency((pedido as any).taxa_entrega)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
                      <span>TOTAL:</span>
                      <span className="text-green-600">{formatCurrency(pedido.valor_total)}</span>
                    </div>
                    <div className="text-right text-gray-500 text-xs">
                      {formatFormaPagamento((pedido as any).forma_pagamento)}
                    </div>
                  </div>

                  {/* GRID DE BOTÕES */}
                  <div className="grid grid-cols-4 gap-1">
                    {/* Confirmar/Avançar status */}
                    {nextStatus && (
                      <button
                        onClick={() => updateStatus(pedido, nextStatus)}
                        className="col-span-4 px-2 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                        title={`Avançar para ${STATUS_CONFIG[nextStatus].label}`}
                      >
                        <ChevronRight className="w-3 h-3" />
                        {STATUS_CONFIG[nextStatus].label}
                      </button>
                    )}

                    {/* Botão WPP cliente (Confirmar pedido) */}
                    {(pedido as any).cliente_whatsapp && (
                      <button
                        onClick={() => confirmarPedidoWPP(pedido)}
                        className="px-2 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center justify-center"
                        title="Confirmar pedido (enviar msg ao cliente)"
                      >
                        <MessageCircle className="w-3 h-3" />
                      </button>
                    )}

                    {/* Desconto */}
                    <button
                      onClick={() => abrirModalDesconto(pedido)}
                      className="px-2 py-1.5 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 flex items-center justify-center"
                      title="Dar desconto"
                    >
                      <Tag className="w-3 h-3" />
                    </button>

                    {/* Editar */}
                    <button
                      onClick={() => abrirModalEditar(pedido)}
                      className="px-2 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 flex items-center justify-center"
                      title="Editar pedido"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>

                    {/* Imprimir */}
                    <button
                      onClick={() => imprimirPedido(pedido)}
                      className="px-2 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-800 flex items-center justify-center"
                      title="Imprimir pedido"
                    >
                      <Printer className="w-3 h-3" />
                    </button>

                    {/* Cancelar */}
                    {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
                      <button
                        onClick={() => updateStatus(pedido, 'cancelado')}
                        className="col-span-4 px-2 py-1.5 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 flex items-center justify-center gap-1"
                        title="Cancelar pedido"
                      >
                        <X className="w-3 h-3" />
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
            <p className="text-gray-500">Os pedidos aparecerão aqui quando chegarem</p>
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
