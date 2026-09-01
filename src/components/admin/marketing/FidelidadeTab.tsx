'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star, Save, TrendingUp, Coins, Eye, Edit } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function FidelidadeTab() {
  const [config, setConfig] = useState({
    fidelidade_ativo: false,
    pontos_por_real: 1,
    cashback_ativo: false,
    cashback_percent: 1,
  })
  const [produtos, setProdutos] = useState<any[]>([])
  const [editandoPts, setEditandoPts] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const supabase = createClient()
  const tenantId=async()=>{const r=await fetch('/api/auth/session',{cache:'no-store'});const b=await r.json();return r.ok?b.tenant?.id:null}

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const tid=await tenantId();if(!tid)return

    // Config geral
    const { data: t } = await supabase.from('tenants').select('config').eq('id', tid).single()
    if (t?.config) {
      const c = t.config as any
      setConfig({
        fidelidade_ativo: !!c.fidelidade_ativo,
        pontos_por_real: c.pontos_por_real ?? 1,
        cashback_ativo: !!c.cashback_ativo,
        cashback_percent: c.cashback_percent ?? 1,
      })
    }

    // Produtos
    const { data: prods } = await supabase
      .from('produtos')
      .select('id, nome, preco, pontos, ativo')
      .eq('tenant_id', tid)
      .order('nome')
    setProdutos(prods || [])
  }

  const salvarConfig = async () => {
    setSalvando(true)
    const tid=await tenantId();if(!tid){setSalvando(false);return}
    const { data: t } = await supabase.from('tenants').select('config').eq('id', tid).single()
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
    setSalvando(false); setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const salvarPontos = async (produtoId: string, pontos: number) => {
    await supabase.from('produtos').update({ pontos }).eq('id', produtoId)
    setEditandoPts(null)
    setProdutos(produtos.map((p) => p.id === produtoId ? { ...p, pontos } : p))
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
            Configure regras globais (regras de fallback) e pontos por produto (regra principal).
            Os pontos por produto têm prioridade sobre as regras globais.
          </p>
        </div>
      </div>

      {/* Regras globais (fallback) */}
      <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span>⚙️</span> Regras globais (usado quando o produto não tem pontos definidos)
        </div>

        {/* Pontos por produto */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg flex items-center justify-center bg-green-100">
                <TrendingUp size={18} className="text-green-700" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Pontos por produto</h4>
                <p className="text-xs text-gray-500">Cada produto define sua própria pontuação</p>
              </div>
            </div>
            <Switch
              checked={config.fidelidade_ativo}
              onChange={(v) => setConfig({ ...config, fidelidade_ativo: v })}
            />
          </div>
          {config.fidelidade_ativo && (
            <div className="bg-green-50 rounded-2xl p-4">
              <p className="text-xs text-gray-600">
                💡 Cada produto pode ter uma quantidade de pontos diferente. Os pontos são somados com base na quantidade de cada produto no pedido. Configure os pontos de cada produto no cadastro ou na lista abaixo.
              </p>
            </div>
          )}
        </div>

        {/* Cashback */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
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
                  type="number" min={0} step={0.1}
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

        <button onClick={salvarConfig} disabled={salvando} className="btn-primary">
          <Save size={14} />
          {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar regras globais'}
        </button>
      </div>

      {/* TABELA DE PONTOS POR PRODUTO */}
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">⭐</span>
          <div>
            <h3 className="text-lg font-semibold">Pontos por produto</h3>
            <p className="text-xs text-gray-500">Configure quantos pontos cada produto dá ao cliente. Tem prioridade sobre a regra global.</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {produtos.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{p.nome}</div>
                <div className="text-xs text-gray-500">{formatCurrency(Number(p.preco))}{!p.ativo && ' · Inativo'}</div>
              </div>
              {editandoPts === p.id ? (
                <>
                  <input
                    type="number"
                    min={0}
                    defaultValue={p.pontos || 0}
                    autoFocus
                    className="form-input w-20 text-center"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvarPontos(p.id, Number((e.target as HTMLInputElement).value) || 0)
                      if (e.key === 'Escape') setEditandoPts(null)
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                      salvarPontos(p.id, Number(input.value) || 0)
                    }}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                  >✓</button>
                  <button onClick={() => setEditandoPts(null)} className="px-2 py-1 bg-gray-300 rounded text-xs">×</button>
                </>
              ) : (
                <>
                  <span className="font-bold text-yellow-700 min-w-[60px] text-right">
                    ⭐ {p.pontos || 0}
                  </span>
                  <button
                    onClick={() => setEditandoPts(p.id)}
                    className="p-1.5 hover:bg-white rounded-lg text-gray-600"
                    title="Editar pontos"
                  >
                    <Edit size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {produtos.length === 0 && (
            <p className="text-center py-8 text-gray-500 text-sm">Nenhum produto cadastrado</p>
          )}
        </div>
      </div>

      {/* INFO BOX - Como o cliente vê */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Como o cliente vê?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Após cada pedido finalizado, os pontos são creditados na conta do cliente</li>
          <li>• O cliente vê seu saldo de pontos e cashback no cardápio (login com WhatsApp)</li>
          <li>• Pode usar pontos/cashback como desconto em pedidos futuros</li>
          <li>• Acesse "Meus Clientes" na aba ao lado para ver saldo de cada cliente</li>
        </ul>
      </div>
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