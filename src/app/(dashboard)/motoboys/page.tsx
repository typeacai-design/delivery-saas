'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import {
  Plus, Edit, Trash2, Save, X, Bike, Phone,
  TrendingUp, DollarSign, AlertCircle, Award
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Motoboy = {
  id: string
  nome: string
  telefone: string
  veiculo: string | null
  placa: string | null
  ativo: boolean
  tipo_comissao: 'percentual' | 'fixa'
  comissao_percent: number
  comissao_fixa: number
  total_entregas: number
  total_ganho: number
  observacoes: string | null
}

export default function MotoboysPage() {
  const [motoboys, setMotoboys] = useState<Motoboy[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Motoboy | null>(null)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) { setLoading(false); return }

    const { data, error } = await supabase
      .from('motoboys')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nome')
    if (!error) setMotoboys(data || [])
    setLoading(false)
  }

  const deletar = async (id: string) => {
    if (!confirm('Tem certeza? Se este motoboy estiver atribuído a pedidos, o vínculo será removido.')) return
    await supabase.from('motoboys').delete().eq('id', id)
    loadData()
  }

  const abrirModal = (m?: Motoboy) => {
    setEditing(m || null)
    setShowModal(true)
  }

  // Stats
  const ativos = motoboys.filter((m) => m.ativo)
  const totalEntregas = motoboys.reduce((acc, m) => acc + (m.total_entregas || 0), 0)
  const totalGanho = motoboys.reduce((acc, m) => acc + Number(m.total_ganho || 0), 0)
  const top = [...motoboys]
    .filter((m) => m.ativo && m.total_entregas > 0)
    .sort((a, b) => b.total_entregas - a.total_entregas)
    .slice(0, 3)

  return (
    <div>
      <div className="bg-white rounded-2xl border p-5 mb-4 flex items-center justify-between gap-3" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            <Bike size={11} /> Logística
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Motoboys</h1>
          <p className="text-sm text-gray-500 mt-1">
            Entregadores próprios da loja. Configure comissão e acompanhe entregas.
          </p>
        </div>
        <button onClick={() => abrirModal()} className="btn-primary">
          <Plus size={14} />
          Novo motoboy
        </button>
      </div>

      {/* Cards métrica */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Motoboys ativos" value={ativos.length} icon={Bike} color="#3B82F6" />
        <MetricCard label="Total entregas" value={totalEntregas} icon={TrendingUp} color="#16A34A" />
        <MetricCard label="Total pago (comissões)" value={formatCurrency(totalGanho)} icon={DollarSign} color="#A855F7" />
        <div className="bg-white rounded-2xl border p-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: '#FEF9C315' }}>
              <Award size={16} style={{ color: '#EAB308' }} />
            </div>
            <div className="text-xs text-gray-500">Top entregadores</div>
          </div>
          <div className="space-y-1">
            {top.length === 0 ? (
              <div className="text-xs text-gray-400">—</div>
            ) : top.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate">
                  {i + 1}. {m.nome}
                </span>
                <span className="text-gray-500 text-xs">{m.total_entregas}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Carregando...</div>
        ) : motoboys.length === 0 ? (
          <div className="text-center py-12">
            <Bike size={32} className="mx-auto text-gray-300 mb-3" />
            <div className="text-sm text-gray-500">
              Nenhum motoboy cadastrado ainda. Clique em "Novo motoboy" pra começar.
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-3">Motoboy</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Veículo</th>
                <th className="text-left px-4 py-3">Comissão</th>
                <th className="text-right px-4 py-3">Entregas</th>
                <th className="text-right px-4 py-3">Total ganho</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {motoboys.map((m) => (
                <tr key={m.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{m.nome}</div>
                    {!m.ativo && <span className="text-xs text-gray-400">(Inativo)</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <a
                      href={`https://wa.me/55${(m.telefone || '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-700 hover:text-green-600 flex items-center gap-1"
                    >
                      <Phone size={11} />
                      {m.telefone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {m.veiculo || <span className="text-gray-400">—</span>}
                    {m.placa && <span className="text-xs text-gray-500 ml-1">({m.placa})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {m.tipo_comissao === 'fixa'
                      ? `${formatCurrency(Number(m.comissao_fixa))}/entrega`
                      : `${Number(m.comissao_percent).toFixed(1)}% por entrega`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-semibold text-gray-900">{m.total_entregas || 0}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-semibold text-green-700">
                      {formatCurrency(Number(m.total_ganho) || 0)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={m.ativo} onChange={async (v) => {
                      await supabase.from('motoboys').update({ ativo: v }).eq('id', m.id)
                      loadData()
                    }} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirModal(m)} className="size-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600">
                        <Edit size={12} />
                      </button>
                      <button onClick={() => deletar(m.id)} className="size-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <MotoboyModal
          motoboy={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={loadData}
        />
      )}
    </div>
  )
}

function MotoboyModal({ motoboy, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    nome: motoboy?.nome || '',
    telefone: motoboy?.telefone || '',
    veiculo: motoboy?.veiculo || '',
    placa: motoboy?.placa || '',
    tipo_comissao: motoboy?.tipo_comissao || 'percentual',
    comissao_percent: motoboy?.comissao_percent != null ? String(motoboy.comissao_percent) : '5',
    comissao_fixa: motoboy?.comissao_fixa != null ? String(motoboy.comissao_fixa) : '',
    ativo: motoboy?.ativo ?? true,
    observacoes: motoboy?.observacoes || '',
  })
  const [salvando, setSalvando] = useState(false)
  const supabase = createClient()

  const submit = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) return
    setSalvando(true)
    const tenantId = await activeTenantId()
    if (!tenantId) { setSalvando(false); return }

    const payload: any = {
      nome: form.nome,
      telefone: form.telefone.replace(/\D/g, ''),
      veiculo: form.veiculo || null,
      placa: form.placa || null,
      tipo_comissao: form.tipo_comissao,
      comissao_percent: parseFloat(form.comissao_percent) || 0,
      comissao_fixa: parseFloat(form.comissao_fixa) || 0,
      ativo: form.ativo,
      observacoes: form.observacoes || null,
    }

    if (motoboy) {
      await supabase.from('motoboys').update(payload).eq('id', motoboy.id)
    } else {
      await supabase.from('motoboys').insert({
        ...payload,
        tenant_id: tenantId,
      })
    }
    setSalvando(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="text-lg font-semibold text-gray-900">{motoboy ? 'Editar motoboy' : 'Novo motoboy'}</h1>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome" required>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="form-input" placeholder="Ex: João Silva" autoFocus />
            </Field>
            <Field label="Telefone" required>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="form-input" placeholder="(47) 99999-9999" />
            </Field>
            <Field label="Veículo">
              <input value={form.veiculo} onChange={(e) => setForm({ ...form, veiculo: e.target.value })} className="form-input" placeholder="Ex: Honda CG 160" />
            </Field>
            <Field label="Placa">
              <input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} className="form-input" placeholder="ABC-1234" />
            </Field>
          </div>

          <Field label="Tipo de comissão">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo_comissao: 'percentual' })}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition"
                style={
                  form.tipo_comissao === 'percentual'
                    ? { background: 'var(--green)', color: 'white' }
                    : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                }
              >
                % por entrega
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo_comissao: 'fixa' })}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition"
                style={
                  form.tipo_comissao === 'fixa'
                    ? { background: 'var(--green)', color: 'white' }
                    : { background: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                }
              >
                R$ fixo por entrega
              </button>
            </div>
          </Field>

          {form.tipo_comissao === 'percentual' ? (
            <Field label="Comissão (%)" hint="sobre o valor da entrega">
              <input
                type="number"
                step="0.1"
                value={form.comissao_percent}
                onChange={(e) => setForm({ ...form, comissao_percent: e.target.value })}
                className="form-input max-w-[200px]"
                placeholder="5"
              />
            </Field>
          ) : (
            <Field label="Comissão fixa (R$)">
              <input
                type="number"
                step="0.01"
                value={form.comissao_fixa}
                onChange={(e) => setForm({ ...form, comissao_fixa: e.target.value })}
                className="form-input max-w-[200px]"
                placeholder="3.50"
              />
            </Field>
          )}

          <Field label="Observações" hint="(opcional)">
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="form-input"
              rows={2}
              placeholder="Ex: Só atende zona norte"
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="size-4 rounded border-gray-300 text-green-600"
            />
            <span className="text-sm text-gray-900">Ativo</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-white" style={{ borderColor: '#E5E7EB' }}>
          <button onClick={onClose} className="btn-ghost" disabled={salvando}>Cancelar</button>
          <button onClick={submit} className="btn-primary" disabled={salvando || !form.nome.trim() || !form.telefone.trim()}>
            <Save size={14} />
            {salvando ? 'Salvando...' : motoboy ? 'Salvar' : 'Criar motoboy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-2xl border p-4" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
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

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full transition relative"
      style={{ background: checked ? 'var(--green)' : '#D1D5DB' }}
    >
      <div
        className="size-4 rounded-full bg-white absolute top-0.5 transition-all shadow"
        style={{ left: checked ? '20px' : '2px' }}
      />
    </button>
  )
}

