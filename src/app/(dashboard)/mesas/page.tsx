'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Utensils } from 'lucide-react'

export default function MesasPage() {
  const [mesas, setMesas] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ numero: '', nome: '', capacidade: '4' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const res = await fetch('/api/mesas')
    const data = await res.json()
    setMesas(data.mesas || [])
  }

  async function salvar() {
    await fetch('/api/mesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: parseInt(form.numero) || 0,
        nome: form.nome || `Mesa ${form.numero}`,
        capacidade: parseInt(form.capacidade) || 4,
      })
    })
    setShowForm(false)
    setForm({ numero: '', nome: '', capacidade: '4' })
    carregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover mesa?')) return
    await fetch(`/api/mesas?id=${id}`, { method: 'DELETE' })
    carregar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow mb-2">Salão</div>
          <h1 className="text-2xl font-semibold">Mesas</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} /> Nova mesa
        </button>
      </div>

      {showForm && (
        <div className="glass-soft p-6 rounded-2xl space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Nº" value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} className="px-3 py-2 border rounded-xl" />
            <input placeholder="Nome" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="px-3 py-2 border rounded-xl" />
            <input type="number" placeholder="Capacidade" value={form.capacidade} onChange={e => setForm({...form, capacidade: e.target.value})} className="px-3 py-2 border rounded-xl" />
          </div>
          <button onClick={salvar} className="btn-primary">Adicionar mesa</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mesas.length === 0 ? (
          <div className="col-span-full glass-soft p-12 text-center rounded-2xl">
            <Utensils className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Nenhuma mesa cadastrada</p>
          </div>
        ) : mesas.map(m => (
          <div key={m.id} className="glass-soft p-4 rounded-2xl text-center">
            <div className="text-3xl font-bold mb-1">{m.numero}</div>
            <p className="text-sm text-gray-600">{m.nome}</p>
            <p className="text-xs text-gray-400">Capacidade: {m.capacidade}</p>
            <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs ${
              m.status === 'livre' ? 'bg-green-100 text-green-700' :
              m.status === 'ocupada' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>{m.status}</span>
            <button onClick={() => remover(m.id)} className="block mx-auto mt-2 text-red-500 text-xs"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
