'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star, Save, TrendingUp, Coins } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function FidelidadeTab() {
  const [config, setConfig] = useState({
    fidelidade_ativo: false,
    pontos_por_real: 1,
    cashback_ativo: false,
    cashback_percent: 1,
  })
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const supabase = createClient()
  const tenantId=async()=>{const r=await fetch('/api/auth/session',{cache:'no-store'});const b=await r.json();return r.ok?b.tenant?.id:null}

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    const tid=await tenantId();if(!tid)return
    const { data } = await supabase
      .from('tenants')
      .select('config')
      .eq('id', tid)
      .single()
    if (data?.config) {
      const c = data.config as any
      setConfig({
        fidelidade_ativo: !!c.fidelidade_ativo,
        pontos_por_real: c.pontos_por_real ?? 1,
        cashback_ativo: !!c.cashback_ativo,
        cashback_percent: c.cashback_percent ?? 1,
      })
    }
  }

  const salvar = async () => {
    setSalvando(true)
    const tid=await tenantId();if(!tid){setSalvando(false);return}

    const { data: t } = await supabase
      .from('tenants')
      .select('config')
      .eq('id', tid)
      .single()

    const configAtual = (t?.config || {}) as any
    await supabase.from('tenants').update({
      config: {
        ...configAtual,
        fidelidade_ativo: config.fidelidade_ativo,
        pontos_por_real: config.pontos_por_real,
        cashback_ativo: config.cashback_ativo,
        cashback_percent: config.cashback_percent,
      },
    }).eq('id', tid)

    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border p-5 flex items-start gap-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="size-12 rounded-xl flex items-center justify-center bg-yellow-100">
          <Star size={22} className="text-yellow-700" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Programa de Fidelidade + Cashback</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure regras pra recompensar clientes que compram mais na sua loja.
            Os pontos são creditados automaticamente após cada pedido.
          </p>
        </div>
      </div>

      {/* Pontos por real */}
      <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg flex items-center justify-center bg-green-100">
              <TrendingUp size={18} className="text-green-700" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Pontos por real gasto</h4>
              <p className="text-xs text-gray-500">Cliente ganha X pontos a cada R$ 1 em compras</p>
            </div>
          </div>
          <Switch
            checked={config.fidelidade_ativo}
            onChange={(v) => setConfig({ ...config, fidelidade_ativo: v })}
          />
        </div>
        {config.fidelidade_ativo && (
          <div className="bg-green-50 rounded-2xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Pontos por R$ 1 gasto
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={config.pontos_por_real}
              onChange={(e) => setConfig({ ...config, pontos_por_real: parseFloat(e.target.value) || 0 })}
              className="form-input max-w-[200px]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Exemplo: com 1 ponto/R$, um pedido de R$ 35,00 dá 35 pontos ao cliente.
            </p>
          </div>
        )}
      </div>

      {/* Cashback */}
      <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg flex items-center justify-center bg-emerald-100">
              <Coins size={18} className="text-emerald-700" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Cashback em %</h4>
              <p className="text-xs text-gray-500">Cliente recebe de volta X% do valor do pedido</p>
            </div>
          </div>
          <Switch
            checked={config.cashback_ativo}
            onChange={(v) => setConfig({ ...config, cashback_ativo: v })}
          />
        </div>
        {config.cashback_ativo && (
          <div className="bg-emerald-50 rounded-2xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Porcentagem de cashback
            </label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <input
                type="number"
                min={0}
                step={0.1}
                value={config.cashback_percent}
                onChange={(e) => setConfig({ ...config, cashback_percent: parseFloat(e.target.value) || 0 })}
                className="form-input"
              />
              <span className="text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              O valor é acumulado no saldo de cashback do cliente. Pode ser usado em descontos futuros.
            </p>
          </div>
        )}
      </div>

      <button onClick={salvar} disabled={salvando} className="btn-primary">
        <Save size={14} />
        {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar configurações'}
      </button>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-11 h-6 rounded-full transition relative"
      style={{ background: checked ? 'var(--green)' : '#D1D5DB' }}
    >
      <div
        className="size-5 rounded-full bg-white absolute top-0.5 transition-all shadow"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  )
}
