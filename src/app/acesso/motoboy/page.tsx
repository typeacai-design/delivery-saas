'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Bike, LogOut, Loader2, MapPin, Phone, Package, Check, Clock, RefreshCw, Navigation } from 'lucide-react'

interface Pedido {
  id: string
  codigo: string
  status: string
  cliente_nome: string
  cliente_whatsapp: string
  valor_total: number
  data_criacao: string
  endereco_entrega: string
  numero_entrega: string
  bairro_entrega: string
  complemento_entrega: string
  taxa_entrega: number
  pago: boolean
  forma_pagamento: string | string[]
  itens: any[]
}

export default function MotoboyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [membro, setMembro] = useState<any>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [filtro, setFiltro] = useState<'saiu' | 'pronto'>('saiu')

  useEffect(() => {
    // Verificar login
    const membroStr = localStorage.getItem('membro_equipe')
    if (!membroStr) {
      router.push('/acesso')
      return
    }

    const membroData = JSON.parse(membroStr)
    if (membroData.perfil !== 'motoboy') {
      router.push('/acesso')
      return
    }

    setMembro(membroData)
    carregarPedidos(membroData.tenant_id)
    setupRealtime(membroData.tenant_id)
  }, [])

  const carregarPedidos = async (tenantId: string) => {
    const supabase = createClient()

    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(*)')
      .eq('tenant_id', tenantId)
      .in('status', ['pronto', 'saiu'])
      .order('data_criacao', { ascending: true })

    setPedidos(data || [])
    setLoading(false)
  }

  const setupRealtime = (tenantId: string) => {
    const supabase = createClient()
    const channel = supabase
      .channel('motoboy-pedidos')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          carregarPedidos(tenantId)
        }
      })
      .subscribe()
  }

  const marcarSaiu = async (pedido: Pedido) => {
    const supabase = createClient()
    await supabase
      .from('pedidos')
      .update({ status: 'saiu' })
      .eq('id', pedido.id)
    carregarPedidos(membro.tenant_id)
  }

  const marcarEntregue = async (pedido: Pedido) => {
    const supabase = createClient()
    await supabase
      .from('pedidos')
      .update({ status: 'entregue' })
      .eq('id', pedido.id)
    carregarPedidos(membro.tenant_id)
  }

  const abrirWhatsApp = (pedido: Pedido) => {
    const fone = (pedido.cliente_whatsapp || '').replace(/\D/g, '')
    if (fone) {
      window.open(`https://wa.me/55${fone}`, '_blank')
    }
  }

  const abrirMapa = (pedido: Pedido) => {
    const endereco = encodeURIComponent(`${pedido.endereco_entrega}, ${pedido.numero_entrega} ${pedido.bairro_entrega}`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${endereco}`, '_blank')
  }

  const logout = () => {
    localStorage.removeItem('membro_equipe')
    router.push('/acesso')
  }

  const pedidosFiltrados = filtro === 'saiu'
    ? pedidos.filter(p => p.status === 'saiu')
    : pedidos.filter(p => p.status === 'pronto')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-green-600 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Bike size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg">Entregas</h1>
              <p className="text-sm text-green-200">Bem-vindo, {membro?.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => carregarPedidos(membro.tenant_id)}
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
      </div>

      {/* Filtros */}
      <div className="bg-white border-b p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <button
            onClick={() => setFiltro('saiu')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtro === 'saiu'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🛵 Em rota ({pedidos.filter(p => p.status === 'saiu').length})
          </button>
          <button
            onClick={() => setFiltro('pronto')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtro === 'pronto'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📦 Prontos ({pedidos.filter(p => p.status === 'pronto').length})
          </button>
        </div>
      </div>

      {/* Lista de Entregas */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bike size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Nenhuma entrega {filtro === 'saiu' ? 'em rota' : 'pronta'}</p>
            <p className="text-sm mt-1">Aguarde novos pedidos</p>
          </div>
        ) : (
          pedidosFiltrados.map((pedido) => (
            <div
              key={pedido.id}
              className={`bg-white rounded-xl border-2 overflow-hidden ${
                pedido.status === 'saiu' ? 'border-blue-400' : 'border-yellow-400'
              }`}
            >
              {/* Header */}
              <div className={`p-4 ${pedido.status === 'saiu' ? 'bg-blue-50' : 'bg-yellow-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      #{pedido.codigo || pedido.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {pedido.cliente_nome}
                      {pedido.pago ? ' • Pago' : ' • Pendente'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(pedido.valor_total)}
                    </p>
                    {pedido.taxa_entrega > 0 && (
                      <p className="text-xs text-gray-500">+ {formatCurrency(pedido.taxa_entrega)} entrega</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MapPin className="text-green-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {pedido.endereco_entrega}, {pedido.numero_entrega || 's/n'}
                    </p>
                    {pedido.bairro_entrega && (
                      <p className="text-sm text-gray-600">Bairro: {pedido.bairro_entrega}</p>
                    )}
                    {pedido.complemento_entrega && (
                      <p className="text-sm text-gray-500">Complemento: {pedido.complemento_entrega}</p>
                    )}
                  </div>
                </div>

                {/* Itens resumidos */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    <Package size={14} className="inline mr-1" />
                    {pedido.itens?.length || 0} item(s)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(pedido.itens || []).slice(0, 5).map((item: any, idx: number) => (
                      <span key={idx} className="text-xs bg-white px-2 py-1 rounded">
                        {item.quantidade}x {item.nome}
                      </span>
                    ))}
                    {(pedido.itens?.length || 0) > 5 && (
                      <span className="text-xs bg-white px-2 py-1 rounded text-gray-500">
                        +{(pedido.itens?.length || 0) - 5} mais
                      </span>
                    )}
                  </div>
                </div>

                {/* Forma de pagamento */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Pagamento:</span>
                  <span className="font-medium">
                    {Array.isArray(pedido.forma_pagamento)
                      ? pedido.forma_pagamento.join(', ')
                      : pedido.forma_pagamento || '-'}
                  </span>
                  {!pedido.pago && (
                    <span className="text-red-500 font-medium">PENDENTE</span>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="p-4 bg-gray-50 border-t grid grid-cols-3 gap-2">
                <button
                  onClick={() => abrirMapa(pedido)}
                  className="flex items-center justify-center gap-1 py-2 px-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  <Navigation size={14} />
                  Rota
                </button>
                <button
                  onClick={() => abrirWhatsApp(pedido)}
                  className="flex items-center justify-center gap-1 py-2 px-3 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
                >
                  <Phone size={14} />
                  WhatsApp
                </button>
                {pedido.status === 'pronto' ? (
                  <button
                    onClick={() => marcarSaiu(pedido)}
                    className="flex items-center justify-center gap-1 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    <Bike size={14} />
                    Saiu
                  </button>
                ) : (
                  <button
                    onClick={() => marcarEntregue(pedido)}
                    className="flex items-center justify-center gap-1 py-2 px-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                  >
                    <Check size={14} />
                    Entreguei
                  </button>
                )}
              </div>

              {/* Horário */}
              <div className="px-4 py-2 bg-gray-100 text-xs text-gray-500 flex items-center gap-1">
                <Clock size={12} />
                Pedido às {new Date(pedido.data_criacao).toLocaleTimeString('pt-BR')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
