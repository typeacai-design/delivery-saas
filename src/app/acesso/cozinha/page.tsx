'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatarCodigoPedido } from '@/lib/utils'
import { Clock, Check, ChefHat, LogOut, Loader2, Package, RefreshCw } from 'lucide-react'

interface Pedido {
  id: string
  codigo: string
  status: string
  cliente_nome: string
  valor_total: number
  data_criacao: string
  tipo_entrega: string
  itens: any[]
}

export default function CozinhaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [membro, setMembro] = useState<any>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [somAtivado, setSomAtivado] = useState(true)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Verificar login
    const membroStr = localStorage.getItem('membro_equipe')
    if (!membroStr) {
      router.push('/acesso')
      return
    }

    const membroData = JSON.parse(membroStr)
    if (membroData.perfil !== 'cozinha') {
      router.push('/acesso')
      return
    }

    setMembro(membroData)
    carregarPedidos(membroData.tenant_id)
    setupRealtime(membroData.tenant_id)

    // Audio para novos pedidos
    const audio = new Audio('/sounds/pedido-novo.mp3')
    audio.volume = 0.8
    setAudioRef(audio)

    return () => {
      // Cleanup
    }
  }, [])

  const carregarPedidos = async (tenantId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_itens(*)')
      .eq('tenant_id', tenantId)
      .in('status', ['novo', 'preparando'])
      .order('data_criacao', { ascending: true })

    setPedidos(data || [])
    setLoading(false)

    // Tocar som se houver pedidos novos
    if (data && data.length > 0 && audioRef) {
      audioRef.currentTime = 0
      audioRef.play().catch(() => {})
    }
  }

  const setupRealtime = (tenantId: string) => {
    const supabase = createClient()
    const channel = supabase
      .channel('cozinha-pedidos')
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

  const atualizarStatus = async (pedido: Pedido, novoStatus: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('pedidos')
      .update({ status: novoStatus })
      .eq('id', pedido.id)

    if (!error) {
      carregarPedidos(membro.tenant_id)
    }
  }

  const logout = () => {
    localStorage.removeItem('membro_equipe')
    router.push('/acesso')
  }

  const pedidosFiltrados = filtroStatus === 'todos'
    ? pedidos
    : pedidos.filter(p => p.status === filtroStatus)

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
      <div className="bg-orange-600 text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <ChefHat size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg">Cozinha</h1>
              <p className="text-sm text-orange-200">Bem-vindo, {membro?.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSomAtivado(!somAtivado)}
              className={`p-2 rounded-lg ${somAtivado ? 'bg-white/20' : 'bg-white/10'}`}
              title={somAtivado ? 'Som ativado' : 'Som desativado'}
            >
              {somAtivado ? '🔔' : '🔕'}
            </button>
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
        <div className="max-w-6xl mx-auto flex gap-2">
          {['todos', 'novo', 'preparando'].map((status) => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filtroStatus === status
                  ? status === 'novo' ? 'bg-orange-500 text-white'
                  : status === 'preparando' ? 'bg-yellow-500 text-white'
                  : 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'todos' ? `Todos (${pedidos.length})` : status === 'novo' ? `Novos (${pedidos.filter(p => p.status === 'novo').length})` : `Preparando (${pedidos.filter(p => p.status === 'preparando').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="max-w-6xl mx-auto p-4">
        {pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Nenhum pedido para preparar</p>
            <p className="text-sm mt-1">Aguarde novos pedidos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidosFiltrados.map((pedido) => (
              <div
                key={pedido.id}
                className={`bg-white rounded-xl border-2 overflow-hidden ${
                  pedido.status === 'novo' ? 'border-orange-400' : 'border-yellow-400'
                }`}
              >
                {/* Header */}
                <div className={`p-4 ${pedido.status === 'novo' ? 'bg-orange-50' : 'bg-yellow-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {formatarCodigoPedido(pedido.id, pedido.data_criacao, pedido.codigo)}
                      </p>
                      <p className="text-sm text-gray-600">{pedido.cliente_nome}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      pedido.status === 'novo' ? 'bg-orange-500 text-white' : 'bg-yellow-500 text-white'
                    }`}>
                      {pedido.status === 'novo' ? 'NOVO' : 'PREPARANDO'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <Clock size={14} />
                    {new Date(pedido.data_criacao).toLocaleTimeString('pt-BR')}
                  </div>
                </div>

                {/* Itens */}
                <div className="p-4">
                  <ul className="space-y-2">
                    {((pedido as any).pedido_itens || []).map((item: any, idx: number) => (
                      <li key={idx} className="border-b pb-2 last:border-b-0">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-lg">{item.quantidade}x</span>
                          <div className="flex-1">
                            <p className="font-medium">{item.nome}</p>
                            {item.variante_nome && (
                              <p className="text-sm text-gray-500">({item.variante_nome})</p>
                            )}
                            {item.complementos && (
                              <p className="text-xs text-gray-400 mt-1">
                                {typeof item.complementos === 'string' ? item.complementos : JSON.parse(item.complementos).map((c: any) => c.nome).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Ações */}
                <div className="p-4 bg-gray-50 border-t">
                  {pedido.status === 'novo' ? (
                    <button
                      onClick={() => atualizarStatus(pedido, 'preparando')}
                      className="w-full py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition flex items-center justify-center gap-2"
                    >
                      <ChefHat size={18} />
                      INICIAR PREPARO
                    </button>
                  ) : (
                    <button
                      onClick={() => atualizarStatus(pedido, 'pronto')}
                      className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      MARCAR COMO PRONTO
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
