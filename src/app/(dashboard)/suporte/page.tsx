'use client'

import { useState, useEffect } from 'react'
import { HelpCircle, Plus } from 'lucide-react'

export default function SuportePage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ assunto: '', descricao: '', categoria: 'duvida', prioridade: 'normal' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const res = await fetch('/api/tickets')
    const data = await res.json()
    setTickets(data.tickets || [])
  }

  async function abrir() {
    await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setForm({ assunto: '', descricao: '', categoria: 'duvida', prioridade: 'normal' })
    setShowForm(false)
    carregar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow mb-2">Suporte</div>
          <h1 className="text-2xl font-semibold">Tickets</h1>
          <p className="hint mt-1">Abra um ticket e o admin responderá por aqui</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} /> Novo ticket
        </button>
      </div>

      {showForm && (
        <div className="glass-soft p-6 rounded-2xl space-y-3">
          <input
            placeholder="Assunto"
            value={form.assunto}
            onChange={e => setForm({ ...form, assunto: e.target.value })}
            className="w-full px-3 py-2 border rounded-xl"
          />
          <textarea
            placeholder="Descreva seu problema ou dúvida..."
            value={form.descricao}
            onChange={e => setForm({ ...form, descricao: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border rounded-xl"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="px-3 py-2 border rounded-xl">
              <option value="duvida">Dúvida</option>
              <option value="bug">Bug</option>
              <option value="billing">Cobrança</option>
              <option value="sugestao">Sugestão</option>
            </select>
            <select value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })} className="px-3 py-2 border rounded-xl">
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <button onClick={abrir} className="btn-primary">Abrir ticket</button>
        </div>
      )}

      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="glass-soft p-12 text-center rounded-2xl">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Nenhum ticket aberto</p>
          </div>
        ) : tickets.map(t => (
          <div key={t.id} className="glass-soft p-4 rounded-2xl">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">{t.assunto}</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${
                t.status === 'aberto' ? 'bg-yellow-100 text-yellow-700' :
                t.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' :
                t.status === 'resolvido' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>{t.status}</span>
            </div>
            <p className="text-sm text-gray-600">{t.descricao}</p>
            {t.resposta_admin && (
              <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                <p className="text-xs font-semibold text-blue-900 mb-1">Resposta do suporte:</p>
                <p className="text-sm text-blue-900">{t.resposta_admin}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">{new Date(t.created_at).toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
