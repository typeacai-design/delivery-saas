'use client'

import { useEffect, useState } from 'react'
import { Bike, ChefHat, Edit, Plus, Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'

type Role = 'kitchen' | 'motoboy'
type Member = { id: string; nome: string; email: string; role: Role; ativo: boolean }

const roles = [
  { id: 'kitchen' as Role, nome: 'Cozinha', desc: 'Acesso operacional aos pedidos em produção.', icon: ChefHat },
  { id: 'motoboy' as Role, nome: 'Motoboy', desc: 'Acesso operacional às entregas atribuídas.', icon: Bike },
]

export default function EquipePage() {
  const [members, setMembers] = useState<Member[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ nome: string; email: string; role: Role; ativo: boolean }>({
    nome: '', email: '', role: 'kitchen', ativo: true,
  })
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/usuarios-loja')
    const b = await r.json()
    if (r.ok) {
      setMembers(b.usuarios || [])
      setCanManage(!!b.can_manage)
    } else setMessage(b.error)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function start(member?: Member) {
    setEditing(member || null)
    setForm(member
      ? { nome: member.nome, email: member.email, role: member.role, ativo: member.ativo }
      : { nome: '', email: '', role: 'kitchen', ativo: true }
    )
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-dialog-content] input')?.focus()
    })
  }, [open])

  async function save() {
    setActionLoading(true)
    setMessage('')
    try {
      const r = await fetch('/api/usuarios-loja', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      })
      const b = await r.json()
      if (!r.ok) {
        setMessage(b.error || 'Não foi possível salvar.')
        return
      }
      setOpen(false)
      setMessage(editing ? 'Acesso atualizado.' : 'Convite enviado.')
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  async function toggle(member: Member) {
    setActionLoading(true)
    const r = await fetch('/api/usuarios-loja', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...member, ativo: !member.ativo }),
    })
    const b = await r.json()
    if (!r.ok) setMessage(b.error || 'Não foi possível alterar o acesso.')
    else await load()
    setActionLoading(false)
  }

  async function remove(member: Member) {
    if (!confirm(`Excluir o acesso de ${member.nome}?`)) return
    setActionLoading(true)
    const r = await fetch(`/api/usuarios-loja?id=${member.id}`, { method: 'DELETE' })
    const b = await r.json()
    if (!r.ok) setMessage(b.error || 'Não foi possível excluir o acesso.')
    else await load()
    setActionLoading(false)
  }

  return (
    <div className="space-y-5">
      <header className="flex justify-between items-start">
        <div>
          <div className="eyebrow mb-2">Equipe</div>
          <h1 className="text-3xl font-semibold">Acessos operacionais</h1>
          <p className="hint mt-1">Somente Cozinha e Motoboy são disponibilizados nesta etapa.</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => start()}>
            <Plus size={16} />
            Novo acesso
          </button>
        )}
      </header>

      <div className="grid md:grid-cols-2 gap-3">
        {roles.map((role) => (
          <div key={role.id} className="glass p-5">
            <role.icon size={20} />
            <h2 className="font-semibold mt-2">{role.nome}</h2>
            <p className="hint text-sm">{role.desc}</p>
          </div>
        ))}
      </div>

      {message && <p className="text-sm">{message}</p>}

      <section className="glass p-5">
        <h2 className="font-semibold mb-3">Pessoas cadastradas</h2>
        {loading ? (
          <p className="hint">Carregando…</p>
        ) : members.length === 0 ? (
          <p className="hint">Nenhum acesso de Cozinha ou Motoboy cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="glass-soft p-4 flex items-center gap-3">
                <div className="flex-1">
                  <b>{m.nome}</b>
                  <p className="hint text-xs">
                    {m.email} · {roles.find((r) => r.id === m.role)?.nome} · {m.ativo ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
                {canManage && (
                  <>
                    <button className="btn-ghost" onClick={() => toggle(m)}>
                      {m.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button className="btn-icon-round" onClick={() => start(m)}>
                      <Edit size={14} />
                    </button>
                    <button className="btn-icon-round" onClick={() => remove(m)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar acesso' : 'Novo acesso'}
      >
        <div data-dialog-content className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1" style={{ color: '#172033' }}>Nome</span>
            <input
              className="form-input w-full"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1" style={{ color: '#172033' }}>Email</span>
            <input
              type="email"
              className="form-input w-full"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1" style={{ color: '#172033' }}>Função</span>
            <select
              className="form-input w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </label>
          {editing && (
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              <span className="text-sm" style={{ color: '#172033' }}>Acesso ativo</span>
            </label>
          )}
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
