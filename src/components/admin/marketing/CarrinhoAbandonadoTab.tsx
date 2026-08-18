'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Send, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type CarrinhoItem = {
  id: string
  itens_count: number
  valor_estimado: number | null
  updated_at: string
  whatsapp?: string
  nome?: string
}

// Lista clientes que adicionaram itens ao carrinho (em /api/carrinho/salvar)
// mas não finalizaram o pedido, há mais de 24h.
export default function CarrinhoAbandonadoTab() {
  const [itens, setItens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  const load = async () => {
    const response=await fetch('/api/auth/session',{cache:'no-store'});const session=await response.json()
    if(!response.ok||!session.tenant?.id){setLoading(false);return}
    const tid=session.tenant.id

    const limite = new Date()
    limite.setHours(limite.getHours() - 24)

    const { data } = await supabase
      .from('carrinho_salvo')
      .select('id, session_id, whatsapp, itens, valor_estimado, updated_at')
      .eq('tenant_id', tid)
      .lt('updated_at', limite.toISOString())
      .order('updated_at', { ascending: false })

    setItens(data || [])
    setLoading(false)
  }

  const abrirWhats = (w: string, msg: string) => {
    const limpo = w.replace(/\D/g, '')
    window.open(`https://wa.me/55${limpo}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Clock size={20} className="text-orange-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Carrinhos abandonados (+24h)</h3>
            <p className="text-xs text-gray-500">
              Clientes que montaram o carrinho mas não finalizaram o pedido.
              Entre em contato pra recuperar a venda.
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <AlertCircle size={12} />
          Consideramos "abandonado" quando o carrinho não foi finalizado há mais de 24 horas.
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#E5E7EB' }}>
          <Clock size={28} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm text-gray-500">Nenhum carrinho abandonado no momento. 🎉</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {itens.map((c) => {
              const qtd = Array.isArray(c.itens) ? c.itens.length : 0
              const valor = Number(c.valor_estimado) || 0
              const horas = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60))
              const msg = `Oi! Vi que você montou um pedido no nosso cardápio mas não finalizou. Posso te ajudar a concluir? 😊\nValor estimado: ${formatCurrency(valor)}`
              return (
                <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {c.whatsapp || 'Cliente sem WhatsApp'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {qtd} {qtd === 1 ? 'item' : 'itens'} • {formatCurrency(valor)} • há {horas}h
                    </div>
                  </div>
                  {c.whatsapp && (
                    <button
                      onClick={() => abrirWhats(c.whatsapp, msg)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                    >
                      <Send size={12} />
                      Recuperar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
