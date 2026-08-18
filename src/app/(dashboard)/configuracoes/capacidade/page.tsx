'use client'

import { useState, useEffect } from 'react'
import { Clock, Plus, Trash2 } from 'lucide-react'

export default function CapacidadePage() {
  const [turnos, setTurnos] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', dias_semana: [0,1,2,3,4,5,6], hora_inicio: '11:00', hora_fim: '14:00', capacidade_maxima: '10' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const res = await fetch('/api/turnos-capacidade')
    const data = await res.json()
    setTurnos(data.turnos || [])
  }

  async function salvar() {
    await fetch('/api/turnos-capacidade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        dias_semana: form.dias_semana,
        capacidade_maxima: parseInt(form.capacidade_maxima) || 10,
      })
    })
    setShowForm(false)
    setForm({ nome: '', dias_semana: [0,1,2,3,4,5,6], hora_inicio: '11:00', hora_fim: '14:00', capacidade_maxima: '10' })
    carregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover turno?')) return
    await fetch(`/api/turnos-capacidade?id=${id}`, { method: 'DELETE' })
    carregar()
  }

  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function toggleDia(d: number) {
    setForm({
      ...form,
      dias_semana: form.dias_semana.includes(d)
        ? form.dias_semana.filter(x => x !== d)
        : [...form.dias_semana, d]
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow mb-2">Capacidade</div>
          <h1 className="text-2xl font-semibold">Turnos de produção</h1>
          <p className="hint mt-1">Defina quantos pedidos sua loja aguenta por turno</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} /> Novo turno
        </button>
      </div>

      {showForm && (
        <div className="glass-soft p-6 rounded-2xl space-y-3">
          <input placeholder="Nome (ex: Almoço)" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 border rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio: e.target.value})} className="px-3 py-2 border rounded-xl" />
            <input type="time" value={form.hora_fim} onChange={e => setForm({...form, hora_fim: e.target.value})} className="px-3 py-2 border rounded-xl" />
          </div>
          <input type="number" placeholder="Capacidade máxima" value={form.capacidade_maxima} onChange={e => setForm({...form, capacidade_maxima: e.target.value})} className="w-full px-3 py-2 border rounded-xl" />
          <div className="flex gap-2">
            {DIAS.map((d, i) => (
              <button
                key={i}
                onClick={() => toggleDia(i)}
                className={`size-10 rounded-full font-bold text-sm ${form.dias_semana.includes(i) ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
              >{d}</button>
            ))}
          </div>
          <button onClick={salvar} className="btn-primary">Salvar turno</button>
        </div>
      )}

      <div className="space-y-3">
        {turnos.length === 0 ? (
          <div className="glass-soft p-12 text-center rounded-2xl">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Nenhum turno configurado</p>
            <p className="text-sm text-gray-400 mt-2">Quando configurado, o sistema bloqueia novos pedidos se atingir a capacidade</p>
          </div>
        ) : turnos.map(t => (
          <div key={t.id} className="glass-soft p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-semibold">{t.nome}</p>
              <p className="text-sm text-gray-600">{t.hora_inicio} - {t.hora_fim} · Máx {t.capacidade_maxima} pedidos</p>
              <p className="text-xs text-gray-400 mt-1">
                {t.dias_semana.map((d: number) => DIAS[d]).join(', ')}
              </p>
            </div>
            <button onClick={() => remover(t.id)} className="text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
