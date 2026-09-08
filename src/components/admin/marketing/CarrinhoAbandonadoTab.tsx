'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Send, AlertCircle, RefreshCw, ShoppingCart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type CarrinhoItem = {
  id: string
  session_id: string
  cliente_nome?: string | null
  cliente_whatsapp?: string | null
  itens?: any[]
  valor_total?: number | null
  ultimo_acesso: string
  created_at: string
  recuperado?: boolean
}

// Lista TODOS os carrinhos (ativos e abandonados) em tempo real
// - Verde: recente (< 30 min, cliente montando agora)
// - Amarelo: 30min-24h (potencialmente ativo)
// - Vermelho: > 24h (abandonado)
export default function CarrinhoAbandonadoTab() {
  const [itens, setItens] = useState<CarrinhoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    initSession()
  }, [])

  const initSession = async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' })
    const session = await response.json()
    if (!response.ok || !session.tenant?.id) {
      setLoading(false)
      return
    }
    setTenantId(session.tenant.id)
    load(session.tenant.id)
    subscribe(session.tenant.id)
  }

  const load = async (tid: string) => {
    setAtualizando(true)
    // Buscar TODOS os carrinhos (ativos + abandonados), exceto recuperados
    const { data } = await supabase
      .from('carrinho_abandonado')
      .select('id, session_id, cliente_nome, cliente_whatsapp, itens, valor_total, ultimo_acesso, created_at, recuperado')
      .eq('tenant_id', tid)
      .or('recuperado.is.null,recuperado.eq.false')
      .order('ultimo_acesso', { ascending: false })

    setItens(data || [])
    setLoading(false)
    setAtualizando(false)
  }

  // Realtime: atualiza a lista quando qualquer carrinho deste tenant muda
  const subscribe = (tid: string) => {
    const channel = supabase
      .channel(`carrinhos-${tid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carrinho_abandonado', filter: `tenant_id=eq.${tid}` },
        () => load(tid)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  const abrirWhats = (whatsapp: string, msg: string) => {
    const limpo = whatsapp.replace(/\D/g, '')
    window.open(`https://wa.me/55${limpo}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const marcarRecuperado = async (id: string) => {
    await supabase
      .from('carrinho_abandonado')
      .update({ recuperado: true })
      .eq('id', id)
    // Recarregar
    if (tenantId) load(tenantId)
  }

  const getStatusColor = (horas: number) => {
    if (horas < 0.5) return { bg: '#DCFCE7', color: '#166534', label: 'Montando agora' }
    if (horas < 24) return { bg: '#FEF3C7', color: '#92400E', label: `${Math.floor(horas)}h atrás` }
    return { bg: '#FEE2E2', color: '#991B1B', label: `${Math.floor(horas)}h atrás` }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <ShoppingCart size={20} className="text-orange-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">Carrinhos em andamento</h3>
            <p className="text-xs text-gray-500">
              Acompanhe em tempo real quem está montando pedidos. Entre em contato pra recuperar a venda.
            </p>
          </div>
          <button
            onClick={() => tenantId && load(tenantId)}
            disabled={atualizando}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw size={16} className={`text-gray-500 ${atualizando ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
          Atualização em tempo real
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#E5E7EB' }}>
          <Clock size={28} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm text-gray-500">Nenhum cliente montando carrinho agora. 🎉</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {itens.map((c) => {
              const qtd = Array.isArray(c.itens) ? c.itens.length : 0
              const valor = Number(c.valor_total) || 0
              const horas = (Date.now() - new Date(c.ultimo_acesso).getTime()) / (1000 * 60 * 60)
              const status = getStatusColor(horas)
              const whatsapp = c.cliente_whatsapp
              const primeiroItem = Array.isArray(c.itens) && c.itens.length > 0 ? c.itens[0]?.nome : null
              const msg = `Oi${c.cliente_nome ? `, ${c.cliente_nome.split(' ')[0]}` : ''}! Vi que você montou um pedido no nosso cardápio mas não finalizou.${primeiroItem ? ` Você estava olhando ${primeiroItem}` : ''}. Posso te ajudar a concluir? 😊\nValor estimado: ${formatCurrency(valor)}`
              return (
                <div key={c.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {c.cliente_nome || whatsapp || 'Cliente sem WhatsApp'}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {qtd} {qtd === 1 ? 'item' : 'itens'} · {formatCurrency(valor)}
                        {primeiroItem && qtd > 1 ? ` · começando por ${primeiroItem}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {whatsapp && (
                        <button
                          onClick={() => abrirWhats(whatsapp, msg)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                          title="Enviar WhatsApp"
                        >
                          <Send size={12} />
                          Recuperar
                        </button>
                      )}
                      <button
                        onClick={() => marcarRecuperado(c.id)}
                        className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-xs"
                        title="Marcar como recuperado (remove da lista)"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
