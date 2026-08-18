'use client'

import { useState, useMemo } from 'react'
import { Send, MessageCircle, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Cliente = any

type Props = { clientes: Cliente[] }

const VARIAVEIS = [
  { var: '{{nome}}', desc: 'Nome do cliente' },
  { var: '{{telefone}}', desc: 'Telefone' },
  { var: '{{ultimo_pedido}}', desc: 'Dias desde o último pedido' },
  { var: '{{total_pedidos}}', desc: 'Quantidade de pedidos' },
  { var: '{{saldo_cashback}}', desc: 'Saldo de cashback em R$' },
]

export default function DisparoTab({ clientes }: Props) {
  const [filtro, setFiltro] = useState<'todos' | 'vip' | 'inativo' | 'aniversario' | 'novo'>('todos')
  const [mensagem, setMensagem] = useState(
    'Oi {{nome}}! Tudo bem? Aqui é da [NOME DA LOJA]. Sentimos sua falta! Que tal dar uma olhadinha no nosso cardápio? 😊'
  )

  const clientesFiltrados = useMemo(() => {
    const ativos = clientes.filter((c) => c.ativo)
    if (filtro === 'todos') return ativos
    if (filtro === 'vip') return ativos.filter((c) => (c.tags || []).includes('vip'))
    if (filtro === 'novo') return ativos.filter((c) => (c.tags || []).includes('novo'))
    if (filtro === 'inativo') {
      const limite = Date.now() - 30 * 24 * 60 * 60 * 1000
      return ativos.filter((c) =>
        !c.ultimo_pedido_em || new Date(c.ultimo_pedido_em).getTime() < limite
      )
    }
    if (filtro === 'aniversario') {
      const hoje = new Date()
      return ativos.filter((c) => {
        if (!c.data_nascimento) return false
        const dn = new Date(c.data_nascimento)
        return dn.getUTCDate() === hoje.getDate() && dn.getUTCMonth() === hoje.getMonth()
      })
    }
    return ativos
  }, [clientes, filtro])

  const abrirWhatsApp = (telefone: string) => {
    const limpo = telefone.replace(/\D/g, '')
    window.open(`https://wa.me/55${limpo}`, '_blank')
  }

  const dispararUm = (c: Cliente) => {
    const msg = mensagem
      .replace(/\{\{nome\}\}/g, c.nome)
      .replace(/\{\{telefone\}\}/g, c.telefone || '')
      .replace(/\{\{ultimo_pedido\}\}/g, c.ultimo_pedido_em ? `${Math.floor((Date.now() - new Date(c.ultimo_pedido_em).getTime()) / (1000 * 60 * 60 * 24))}d` : '—')
      .replace(/\{\{total_pedidos\}\}/g, String(c.total_pedidos || 0))
      .replace(/\{\{saldo_cashback\}\}/g, formatCurrency(Number(c.saldo_cashback) || 0))
    const limpo = (c.telefone || '').replace(/\D/g, '')
    window.open(`https://wa.me/55${limpo}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 rounded-xl bg-green-100 flex items-center justify-center">
            <MessageCircle size={20} className="text-green-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Disparo de WhatsApp</h3>
            <p className="text-xs text-gray-500">
              Clique em cada cliente pra abrir uma conversa no WhatsApp com a mensagem pronta.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filtro de público</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'todos', label: 'Todos os ativos' },
              { id: 'vip', label: '⭐ VIP' },
              { id: 'novo', label: '✨ Novos' },
              { id: 'inativo', label: '⏰ Inativos (>30d)' },
              { id: 'aniversario', label: '🎂 Aniversariantes' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id as any)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition"
                style={
                  filtro === f.id
                    ? { background: 'var(--green)', color: 'white' }
                    : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
        <label className="block text-sm font-medium text-gray-700 mb-2">Modelo de mensagem</label>
        <textarea
          rows={5}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          className="form-input"
        />
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Variáveis:</span>
          {VARIAVEIS.map((v) => (
            <button
              key={v.var}
              type="button"
              onClick={() => setMensagem((m) => m + ' ' + v.var)}
              className="text-[11px] px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono"
              title={v.desc}
            >
              {v.var}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-sm font-medium text-gray-700">
            {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''} selecionado{clientesFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>

        {clientesFiltrados.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Nenhum cliente encaixa nesse filtro.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {clientesFiltrados.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{c.nome}</div>
                  <div className="text-xs text-gray-500">
                    {c.telefone}
                    {c.total_pedidos ? ` • ${c.total_pedidos} pedido${c.total_pedidos !== 1 ? 's' : ''}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => dispararUm(c)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                >
                  <Send size={12} />
                  Disparar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-2">
        <AlertCircle size={16} className="text-blue-700 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800">
          <strong>Como funciona:</strong> ao clicar em "Disparar", abrimos uma nova aba do WhatsApp Web já com a mensagem preenchida,
          pronta pra enviar. Você mantém o controle final do envio. Respeite o consentimento do cliente (LGPD).
        </div>
      </div>
    </div>
  )
}
