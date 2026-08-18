'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { Plus, Edit, Trash2, Package, AlertCircle, X, Save } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Insumo = {
  id: string
  nome: string
  unidade: string
  quantidade_atual: number
  estoque_minimo: number
  custo_unitario: number
}

const UNIDADES = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'kg', label: 'Quilo (kg)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'l', label: 'Litro (l)' },
]

/**
 * Matéria-prima = ingredientes do estoque.
 * Usa a tabela `insumos` que já existe (mesmo conceito, nome diferente
 * para o lojista ver como "matéria-prima do produto").
 */
export default function MateriaPrimaTab() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Insumo | null>(null)
  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const tid = await activeTenantId()
    if (!tid) { setLoading(false); return }

    const { data } = await supabase
      .from('insumos')
      .select('*')
      .eq('tenant_id', tid)
      .order('nome')
    setInsumos(data || [])
    setLoading(false)
  }

  const deletar = async (id: string) => {
    if (!confirm('Tem certeza? Se este insumo estiver vinculado a um produto, o vínculo também será removido.')) return
    await supabase.from('insumos').delete().eq('id', id)
    loadAll()
  }

  const abrirModal = (insumo?: Insumo) => {
    setEditing(insumo || null)
    setShowModal(true)
  }

  const salvar = async (dados: any) => {
    const tenantId = await activeTenantId()
    if (!tenantId) return
    if (editing) {
      await supabase.from('insumos').update({
        nome: dados.nome,
        unidade: dados.unidade,
        quantidade_atual: dados.quantidade_atual,
        estoque_minimo: dados.estoque_minimo,
        custo_unitario: dados.custo_unitario,
      }).eq('id', editing.id)
    } else {
      await supabase.from('insumos').insert({
        tenant_id: tenantId,
        nome: dados.nome,
        unidade: dados.unidade,
        quantidade_atual: dados.quantidade_atual,
        estoque_minimo: dados.estoque_minimo,
        custo_unitario: dados.custo_unitario,
      })
    }
    setShowModal(false)
    setEditing(null)
    loadAll()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <div className="text-xs text-gray-500 mb-1">Ingredientes</div>
          <h2 className="text-lg font-semibold text-gray-900">Matéria-prima</h2>
          <p className="text-xs text-gray-500 mt-1">
            Cadastre aqui os ingredientes que entram nos produtos (pão, queijo, carne...).
            Ao vincular ao produto, o estoque baixa automaticamente a cada pedido.
          </p>
        </div>
        <button onClick={() => abrirModal()} className="btn-primary">
          <Plus size={14} />
          Novo ingrediente
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : insumos.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="size-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.12)' }}>
            <Package size={28} className="text-green-700" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Vamos começar!</h3>
          <p className="text-gray-500 mb-5 max-w-sm mx-auto text-sm">
            Cadastre seus ingredientes (Pão, Queijo, Carne, Ovo, Salada...) com unidade e custo.
            Depois é só vincular ao produto.
          </p>
          <button onClick={() => abrirModal()} className="btn-primary">
            <Plus size={14} />
            Cadastrar primeiro ingrediente
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {insumos.map((ins) => {
            const low = Number(ins.quantidade_atual) <= Number(ins.estoque_minimo)
            const totalValor = Number(ins.quantidade_atual) * Number(ins.custo_unitario)
            return (
              <div
                key={ins.id}
                className="bg-white rounded-2xl border p-4 flex items-center gap-4"
                style={{ borderColor: low ? '#FCA5A5' : '#E5E7EB', background: low ? '#FEF2F2' : undefined }}
              >
                <div className="size-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.12)' }}>
                  <Package size={20} className="text-green-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{ins.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{UNIDADES.find((u) => u.value === ins.unidade)?.label || ins.unidade}</span>
                    <span>•</span>
                    <span>
                      <strong className={low ? 'text-red-700' : 'text-gray-900'}>
                        {Number(ins.quantidade_atual).toFixed(2)}
                      </strong>
                      {' '}/{ins.estoque_minimo} mínimo
                    </span>
                    {low && (
                      <span className="text-red-700 font-semibold flex items-center gap-1">
                        <AlertCircle size={11} /> Estoque baixo
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Custo unitário</div>
                  <div className="text-sm font-semibold text-gray-900">{formatCurrency(Number(ins.custo_unitario))}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Total: <strong>{formatCurrency(totalValor)}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => abrirModal(ins)}
                    className="size-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600"
                    title="Editar"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => deletar(ins.id)}
                    className="size-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600"
                    title="Apagar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <MateriaPrimaModal
          insumo={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={salvar}
        />
      )}
    </div>
  )
}

function MateriaPrimaModal({ insumo, onClose, onSave }: any) {
  const [form, setForm] = useState({
    nome: insumo?.nome || '',
    unidade: insumo?.unidade || 'un',
    quantidade_atual: insumo?.quantidade_atual != null ? String(insumo.quantidade_atual) : '',
    estoque_minimo: insumo?.estoque_minimo != null ? String(insumo.estoque_minimo) : '',
    custo_unitario: insumo?.custo_unitario != null ? String(insumo.custo_unitario) : '',
  })
  const [salvando, setSalvando] = useState(false)

  const num = (v: string) => (v === '' ? 0 : parseFloat(v))

  const submit = async () => {
    if (!form.nome.trim()) return
    setSalvando(true)
    await onSave({
      nome: form.nome,
      unidade: form.unidade,
      quantidade_atual: num(form.quantidade_atual),
      estoque_minimo: num(form.estoque_minimo),
      custo_unitario: num(form.custo_unitario),
    })
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="text-lg font-semibold text-gray-900">{insumo ? 'Editar ingrediente' : 'Novo ingrediente'}</h1>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 bg-gray-50">
          <Field label="Nome" required>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Pão de hambúrguer"
              className="form-input"
              autoFocus
            />
          </Field>

          <Field label="Unidade de medida" required>
            <select
              value={form.unidade}
              onChange={(e) => setForm({ ...form, unidade: e.target.value })}
              className="form-input"
            >
              {UNIDADES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Custo unitário (R$)">
            <input
              type="number"
              step="0.0001"
              value={form.custo_unitario}
              onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
              placeholder="0,50"
              className="form-input"
            />
            <p className="text-xs text-gray-500 mt-1">Custo por 1 unidade da medida selecionada.</p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Estoque atual">
              <input
                type="number"
                step="0.01"
                value={form.quantidade_atual}
                onChange={(e) => setForm({ ...form, quantidade_atual: e.target.value })}
                placeholder="0"
                className="form-input"
              />
            </Field>
            <Field label="Estoque mínimo" hint="(aviso)">
              <input
                type="number"
                step="0.01"
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
                placeholder="0"
                className="form-input"
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-white" style={{ borderColor: '#E5E7EB' }}>
          <button onClick={onClose} className="btn-ghost" disabled={salvando}>Cancelar</button>
          <button
            onClick={submit}
            className="btn-primary"
            disabled={salvando || !form.nome.trim()}
          >
            <Save size={14} />
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, hint, children }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="text-gray-400 font-normal ml-1">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

