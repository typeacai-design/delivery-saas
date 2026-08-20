'use client'

import { useState, useEffect } from 'react'
import { Boxes, Sparkles, AlertTriangle, Check } from 'lucide-react'
import MateriaPrimaTab from '@/components/admin/MateriaPrimaTab'

export default function GestaoPage() {
  const [venderSemEstoque, setVenderSemEstoque] = useState<string>('nao')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const r = await fetch('/api/configuracoes/entregas', { cache: 'no-store' })
      const b = await r.json()
      if (r.ok) {
        const valor = b.config?.entrega_km?.vender_sem_estoque
        setVenderSemEstoque(valor === true ? 'sim' : 'nao')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const salvar = async () => {
    if (loading) return
    setSalvando(true)
    setMsg('')
    try {
      const config = { entrega_km: { vender_sem_estoque: venderSemEstoque === 'sim' } }
      const r = await fetch('/api/configuracoes/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'config', config })
      })
      const b = await r.json()
      if (r.ok) {
        setMsg('Salvo com sucesso!')
      } else {
        setMsg('Erro ao salvar')
      }
    } catch (e) {
      setMsg('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10">
          <div className="eyebrow mb-2 flex items-center gap-1.5"><Sparkles size={11}/>Operação</div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Matéria-prima</h1>
          <p className="hint mt-2">Cadastro, custo e saldo dos insumos usados nos produtos.</p>
        </div>
      </div>

      {/* Vender Sem Estoque */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3">
          <div className={`size-10 rounded-lg flex items-center justify-center ${venderSemEstoque === 'sim' ? 'bg-green-100' : 'bg-gray-100'}`}>
            {venderSemEstoque === 'sim' ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">Vender mesmo sem estoque</p>
            <p className="text-xs text-gray-500">Permite pedidos sem estoque de matéria-prima</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
          <select
            value={venderSemEstoque}
            onChange={(e) => setVenderSemEstoque(e.target.value)}
            disabled={loading}
            className="form-input"
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
          <button
            onClick={salvar}
            disabled={salvando || loading}
            className="btn-primary text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm font-semibold"><Boxes size={16}/>Insumos</div>
      <MateriaPrimaTab />
      <p className="hint text-xs mt-4">Entradas e saídas operacionais foram centralizadas em Financeiro.</p>
    </div>
  )
}
