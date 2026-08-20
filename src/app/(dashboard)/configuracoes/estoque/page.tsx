'use client'

import { useState, useEffect } from 'react'
import { Package, AlertTriangle, Check } from 'lucide-react'

export default function EstoqueConfigPage() {
  const [venderSemEstoque, setVenderSemEstoque] = useState(false)
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
        setVenderSemEstoque(b.config?.entrega_km?.vender_sem_estoque === true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const salvar = async () => {
    setSalvando(true)
    setMsg('')
    try {
      const config = { entrega_km: { vender_sem_estoque: venderSemEstoque } }
      const r = await fetch('/api/configuracoes/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'config', config })
      })
      const b = await r.json()
      if (r.ok) {
        setMsg('✅ Configuração salva com sucesso!')
      } else {
        setMsg('❌ ' + (b.error || 'Erro ao salvar'))
      }
    } catch (e) {
      setMsg('❌ Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow mb-2">Configurações</div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
          Controle de Estoque
        </h1>
        <p className="hint">Configure como o sistema lida com estoque insuficiente</p>
      </div>

      {msg && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border text-center">
          {msg}
        </div>
      )}

      <div className="max-w-2xl">
        {/* Toggle de Vender Sem Estoque */}
        <div className="bg-white rounded-2xl border p-6 mb-6" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-start gap-4">
            <div className={`size-12 rounded-xl flex items-center justify-center ${venderSemEstoque ? 'bg-green-100' : 'bg-amber-100'}`}>
              {venderSemEstoque ? (
                <Check className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Vender mesmo sem estoque</h3>
              <p className="text-gray-500 text-sm mb-4">
                Quando ativado, os clientes poderão finalizar pedidos mesmo quando matéria-prima,
                complementos ou produtos estiverem sem estoque. O pedido será registrado normalmente
                e aparecerá na fila de pedidos para que o lojista avalie.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative size-12 rounded-full transition-colors ${venderSemEstoque ? 'bg-green-500' : 'bg-gray-300'}`}
                  onClick={() => !loading && setVenderSemEstoque(!venderSemEstoque)}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  <div
                    className={`absolute top-1 size-10 bg-white rounded-full shadow transition-transform ${venderSemEstoque ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </div>
                <span className="font-medium">
                  {venderSemEstoque ? 'Ativado' : 'Desativado'}
                </span>
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={salvar}
          disabled={salvando || loading}
          className="btn-primary w-full justify-center"
        >
          {salvando ? 'Salvando...' : 'Salvar Configuração'}
        </button>

        <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">💡 Como funciona?</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Desativado (padrão):</strong> o sistema verifica estoque antes de finalizar o pedido. Se faltar matéria-prima, o pedido é bloqueado.</li>
            <li>• <strong>Ativado:</strong> o pedido é finalizado normalmente, mas o lojista deve ficar atento à disponibilidade dos itens.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
