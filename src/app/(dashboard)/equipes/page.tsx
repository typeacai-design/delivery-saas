'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { useToast } from '@/components/toast'
import { Plus, Trash2, User, ChefHat, Bike, Shield, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react'

interface MembroEquipe {
  id: string
  nome: string
  username: string
  perfil: 'owner' | 'manager' | 'attendant' | 'cozinha' | 'motoboy'
  ativo: boolean
}

const PERFIL_CONFIG: Record<string, { label: string; icon: typeof User; color: string; description: string }> = {
  owner: { label: 'Proprietário', icon: ShieldCheck, color: 'bg-purple-100 text-purple-700', description: 'Acesso total' },
  manager: { label: 'Gerente', icon: Shield, color: 'bg-blue-100 text-blue-700', description: 'Gerencia loja' },
  attendant: { label: 'Atendente', icon: User, color: 'bg-gray-100 text-gray-700', description: 'Atendimento' },
  cozinha: { label: 'Cozinha', icon: ChefHat, color: 'bg-orange-100 text-orange-700', description: 'Acesso pedidos + cozinha' },
  motoboy: { label: 'Motoboy', icon: Bike, color: 'bg-green-100 text-green-700', description: 'Página de entregas' },
}

export default function EquipesPage() {
  const { error: toastError, success: toastSuccess } = useToast()
  const [loading, setLoading] = useState(true)
  const [membros, setMembros] = useState<MembroEquipe[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<MembroEquipe | null>(null)
  const [formData, setFormData] = useState<{ nome: string; username: string; password: string; perfil: 'owner' | 'manager' | 'attendant' | 'cozinha' | 'motoboy' }>({ nome: '', username: '', password: '', perfil: 'attendant' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    carregarMembros()
  }, [])

  const carregarMembros = async () => {
    const supabase = createClient()
    const tid = await activeTenantId()
    if (!tid) {
      toastError('Erro', 'Tenant não encontrado')
      setLoading(false)
      return
    }
    setTenantId(tid)

    const { data, error } = await supabase
      .from('membros_equipe')
      .select('id, nome, username, perfil, ativo')
      .eq('tenant_id', tid)
      .order('created_at')

    if (error) {
      toastError('Erro ao carregar', error.message)
    } else {
      setMembros(data || [])
    }
    setLoading(false)
  }

  const abrirNovo = () => {
    setEditando(null)
    setFormData({ nome: '', username: '', password: '', perfil: 'attendant' })
    setShowModal(true)
  }

  const abrirEditar = (membro: MembroEquipe) => {
    setEditando(membro)
    setFormData({ nome: membro.nome, username: membro.username, password: '', perfil: membro.perfil })
    setShowModal(true)
  }

  const salvar = async () => {
    if (!formData.nome.trim() || !formData.username.trim()) {
      toastError('Erro', 'Nome e usuário são obrigatórios')
      return
    }
    if (!editando && !formData.password.trim()) {
      toastError('Erro', 'Senha é obrigatória para novos membros')
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      if (editando) {
        // Atualizar
        const updates: any = { nome: formData.nome, perfil: formData.perfil, updated_at: new Date().toISOString() }
        if (formData.password.trim()) {
          // Hash simples (em produção usar bcrypt no server)
          updates.password_hash = formData.password
        }

        const { error } = await supabase
          .from('membros_equipe')
          .update(updates)
          .eq('id', editando.id)

        if (error) throw error
        toastSuccess('Membro atualizado', `${formData.nome} foi atualizado`)
      } else {
        // Criar novo
        const { error } = await supabase.from('membros_equipe').insert({
          tenant_id: tenantId,
          nome: formData.nome,
          username: formData.username,
          password_hash: formData.password,
          perfil: formData.perfil,
        })

        if (error) throw error
        toastSuccess('Membro criado', `${formData.nome} foi adicionado à equipe`)
      }

      setShowModal(false)
      carregarMembros()
    } catch (err: any) {
      toastError('Erro', err.message || 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const toggleAtivo = async (membro: MembroEquipe) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('membros_equipe')
      .update({ ativo: !membro.ativo, updated_at: new Date().toISOString() })
      .eq('id', membro.id)

    if (error) {
      toastError('Erro', error.message)
    } else {
      toastSuccess(membro.ativo ? 'Membro desativado' : 'Membro ativado', membro.nome)
      carregarMembros()
    }
  }

  const excluir = async (membro: MembroEquipe) => {
    if (!confirm(`Excluir ${membro.nome} da equipe?`)) return

    const supabase = createClient()
    const { error } = await supabase.from('membros_equipe').delete().eq('id', membro.id)

    if (error) {
      toastError('Erro', error.message)
    } else {
      toastSuccess('Excluído', membro.nome)
      carregarMembros()
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie acessos de cozinha e motoboys</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
        >
          <Plus size={18} />
          Novo membro
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">Perfis de acesso</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(PERFIL_CONFIG).map(([key, config]) => {
            const Icon = config.icon
            return (
              <div key={key} className="flex items-start gap-2">
                <div className={`p-1.5 rounded-lg ${config.color}`}>
                  <Icon size={14} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900">{config.label}</p>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de membros */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      ) : membros.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <User size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Nenhum membro cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo membro" para adicionar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          {membros.map((membro) => {
            const config = PERFIL_CONFIG[membro.perfil] || PERFIL_CONFIG.attendant
            const Icon = config.icon
            return (
              <div
                key={membro.id}
                className={`flex items-center gap-4 p-4 border-b last:border-b-0 ${!membro.ativo ? 'opacity-50' : ''}`}
              >
                <div className={`p-2.5 rounded-full ${config.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{membro.nome}</p>
                  <p className="text-sm text-gray-500">@{membro.username} • {config.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAtivo(membro)}
                    className={`p-2 rounded-lg transition ${membro.ativo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title={membro.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {membro.ativo ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button
                    onClick={() => abrirEditar(membro)}
                    className="p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                    title="Editar"
                  >
                    <User size={18} />
                  </button>
                  <button
                    onClick={() => excluir(membro)}
                    className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editando ? 'Editar membro' : 'Novo membro'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário (login)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="usuario"
                  disabled={!!editando}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha {editando && <span className="text-gray-400">(deixe em branco para manter)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Perfil de acesso</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PERFIL_CONFIG).map(([key, config]) => {
                    const Icon = config.icon
                    return (
                      <button
                        key={key}
                        onClick={() => setFormData({ ...formData, perfil: key as any })}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${formData.perfil === key ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Icon size={16} className={formData.perfil === key ? 'text-green-600' : 'text-gray-500'} />
                        <span className={`text-sm font-medium ${formData.perfil === key ? 'text-green-700' : 'text-gray-700'}`}>
                          {config.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
