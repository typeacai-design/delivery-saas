'use client'

import { useEffect, useState } from 'react'
import { Bike, ChefHat, Edit, Plus, Trash2, KeyRound, Copy, Check } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/toast'

type Perfil = 'attendant'
type Member = { id: string; nome: string; username: string; perfil: Perfil; ativo: boolean }

const perfis = [
  { id: 'attendant' as Perfil, nome: 'Atendimento', desc: 'Operador com acesso total à aba de pedidos (delivery, mesas, retirada).', icon: ChefHat },
]

export default function EquipePage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [canManage, setCanManage] = useState(true) // logado como owner/manager no sistema
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ nome: string; username: string; senha: string; perfil: Perfil }>({
    nome: '', username: '', senha: '', perfil: 'attendant',
  })
  const [senhaEdit, setSenhaEdit] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/membros-equipe')
      const b = await r.json()
      if (r.ok) {
        setMembers(b.membros || [])
        setCanManage(true)
      } else {
        toastError('Erro ao carregar', b.error)
      }
    } catch (e: any) {
      toastError('Erro de rede', e?.message || 'falha ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function start(member?: Member) {
    setEditing(member || null)
    setForm(member
      ? { nome: member.nome, username: member.username, senha: '', perfil: member.perfil }
      : { nome: '', username: '', senha: '', perfil: 'attendant' }
    )
    setSenhaEdit('')
    setOpen(true)
  }

  async function save() {
    setActionLoading(true)
    try {
      const payload: any = { nome: form.nome, username: form.username, perfil: form.perfil }
      if (form.senha) payload.senha = form.senha

      const r = await fetch('/api/membros-equipe', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      const b = await r.json()
      if (!r.ok) {
        toastError('Não foi possível salvar', b.error)
        return
      }
      setOpen(false)
      toastSuccess(editing ? 'Acesso atualizado.' : 'Acesso criado.')
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  async function resetSenha(member: Member) {
    const nova = prompt(`Nova senha para ${member.nome}:`, '')
    if (!nova || nova.length < 4) {
      toastError('Senha inválida', 'Mínimo 4 caracteres')
      return
    }
    setActionLoading(true)
    const r = await fetch(`/api/membros-equipe?id=${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha: nova }),
    })
    setActionLoading(false)
    if (r.ok) toastSuccess('Senha redefinida')
    else toastError('Erro', (await r.json()).error)
  }

  async function toggle(member: Member) {
    setActionLoading(true)
    const r = await fetch(`/api/membros-equipe?id=${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !member.ativo }),
    })
    setActionLoading(false)
    if (r.ok) {
      toastSuccess(member.ativo ? 'Acesso desativado' : 'Acesso ativado')
      await load()
    } else {
      toastError('Erro', (await r.json()).error)
    }
  }

  async function remove(member: Member) {
    if (!confirm(`Excluir o acesso de ${member.nome}?`)) return
    setActionLoading(true)
    const r = await fetch(`/api/membros-equipe?id=${member.id}`, { method: 'DELETE' })
    setActionLoading(false)
    if (r.ok) {
      toastSuccess('Acesso removido')
      await load()
    } else {
      toastError('Erro', (await r.json()).error)
    }
  }

  function copiarLink(perfil: Perfil) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${base}/acesso?perfil=${perfil}`
    navigator.clipboard.writeText(url)
    toastSuccess('Link copiado!', url)
  }

  return (
    <div className="space-y-5">
      <header className="flex justify-between items-start">
        <div>
          <div className="eyebrow mb-2">Equipe</div>
          <h1 className="text-3xl font-semibold">Acessos operacionais</h1>
          <p className="hint mt-1">Atendentes acessam com usuário e senha.</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => start()}>
            <Plus size={16} />
            Novo acesso
          </button>
        )}
      </header>

      {/* Cards explicativos com link rápido */}
      <div className="grid md:grid-cols-2 gap-3">
        {perfis.map((role) => (
          <div key={role.id} className="glass p-5">
            <role.icon size={20} />
            <h2 className="font-semibold mt-2">{role.nome}</h2>
            <p className="hint text-sm">{role.desc}</p>
            <button
              onClick={() => copiarLink(role.id)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              <Copy size={12} /> Copiar link de acesso
            </button>
          </div>
        ))}
      </div>

      {members.length > 0 && (
        <section className="glass p-4">
          <h2 className="font-semibold mb-3">Pessoas cadastradas</h2>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="glass-soft p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <b>{m.nome}</b>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="hint text-xs mt-0.5">
                    usuário: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{m.username}</code>
                    {' · '}{perfis.find((r) => r.id === m.perfil)?.nome}
                  </p>
                </div>
                <button className="btn-ghost flex items-center gap-1" onClick={() => toggle(m)}>
                  {m.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  className="btn-icon-round"
                  onClick={() => resetSenha(m)}
                  title="Redefinir senha"
                >
                  <KeyRound size={14} />
                </button>
                <button className="btn-icon-round" onClick={() => start(m)} title="Editar">
                  <Edit size={14} />
                </button>
                <button className="btn-icon-round" onClick={() => remove(m)} title="Excluir">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar acesso' : 'Novo acesso'}
      >
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1" style={{ color: '#172033' }}>Nome</span>
            <input
              className="form-input w-full"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: João Cozinha"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1" style={{ color: '#172033' }}>Usuário</span>
            <input
              className="form-input w-full"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="ex: joao_cozinha"
            />
            <span className="text-xs text-gray-500">Use letras, números e underscore. Mín. 3 caracteres.</span>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1" style={{ color: '#172033' }}>
              {editing ? 'Nova senha (deixe vazio para manter)' : 'Senha'}
            </span>
            <input
              type="password"
              className="form-input w-full"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder={editing ? '••••••' : 'Mínimo 4 caracteres'}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1" style={{ color: '#172033' }}>Função</span>
            <select
              className="form-input w-full"
              value={form.perfil}
              onChange={(e) => setForm({ ...form, perfil: e.target.value as Perfil })}
            >
              {perfis.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </label>
          <button
            disabled={actionLoading}
            className="btn-primary w-full disabled:opacity-50"
            onClick={save}
          >
            {actionLoading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
