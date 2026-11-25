'use client'

import { useEffect, useState } from 'react'
import { Bike, ChefHat, Copy, Check, KeyRound, Pencil, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { FUNCOES_EQUIPE, NOME_FUNCAO, SENHA_MINIMA, formatarCelular, type FuncaoEquipe } from '@/lib/equipe'
import { MODOS_DISTRIBUICAO, NOME_MODO, type ModoDistribuicao } from '@/lib/entregas'

const DESCRICAO_MODO: Record<ModoDistribuicao, string> = {
  motoboys_escolhem: 'Toda entrega pronta aparece para os motoboys disponíveis; quem pegar primeiro leva.',
  lojista_escolhe: 'Você escolhe o motoboy no detalhe de cada pedido de entrega.',
  automatico: 'O sistema entrega para o próximo motoboy disponível, por ordem.',
}

type Membro = { id: string; nome: string; telefone: string | null; role: FuncaoEquipe; ativo: boolean; disponivel: boolean; created_at: string }
const ICONE: Record<FuncaoEquipe, typeof ChefHat> = { kitchen: ChefHat, attendant: UtensilsCrossed, motoboy: Bike }
const vazio = { nome: '', celular: '', senha: '', funcao: 'kitchen' as FuncaoEquipe }

export default function EquipePage() {
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState<Membro | null>(null)
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [modo, setModo] = useState<ModoDistribuicao | null>(null)

  const carregar = async () => {
    setCarregando(true)
    const r = await fetch('/api/equipe', { cache: 'no-store' })
    const b = await r.json().catch(() => ({}))
    if (r.ok) setEquipe(b.equipe || []); else setErro(b.error || 'Não foi possível carregar a equipe')
    setCarregando(false)
  }
  useEffect(() => {
    const t = window.setTimeout(() => { void carregar() }, 0)
    fetch('/api/equipe/configuracao', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(b => { if (b) setModo(b.distribuicao) }).catch(() => {})
    return () => window.clearTimeout(t)
  }, [])
  const salvarModo = async (novo: ModoDistribuicao) => {
    const anterior = modo; setModo(novo)
    const r = await fetch('/api/equipe/configuracao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ distribuicao: novo }) })
    if (!r.ok) { setModo(anterior); setAviso('Não foi possível salvar a forma de distribuição') } else setAviso(`Entregas: ${NOME_MODO[novo]}.`)
  }

  const abrirNovo = () => { setEditando(null); setForm(vazio); setErro(''); setAberto(true) }
  const abrirEdicao = (m: Membro) => { setEditando(m); setForm({ nome: m.nome, celular: formatarCelular(m.telefone), senha: '', funcao: m.role }); setErro(''); setAberto(true) }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('')
    try {
      const r = editando
        ? await fetch(`/api/equipe/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: form.nome, funcao: form.funcao, ...(form.senha ? { senha: form.senha } : {}) }) })
        : await fetch('/api/equipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(b.error || 'Não foi possível salvar'); return }
      setAberto(false)
      setAviso(b.jaTinhaConta ? `${b.membro.nome} já tinha acesso ao WeDelivery: entra com a senha que já usa.` : editando ? 'Alterações salvas.' : `${b.membro.nome} cadastrado. Envie o link de acesso para a pessoa.`)
      await carregar()
    } catch { setErro('Sem conexão. Tente novamente.') } finally { setSalvando(false) }
  }

  const alternarAtivo = async (m: Membro) => {
    const r = await fetch(`/api/equipe/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !m.ativo }) })
    if (r.ok) await carregar()
  }
  const remover = async (m: Membro) => {
    if (!confirm(`Remover ${m.nome} da equipe? A pessoa perde o acesso na hora.`)) return
    const r = await fetch(`/api/equipe/${m.id}`, { method: 'DELETE' })
    const b = await r.json().catch(() => ({}))
    if (r.ok) await carregar(); else setAviso(b.error || 'Não foi possível remover')
  }
  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/acesso`); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 1800) } catch { /* noop */ }
  }

  return <div className="space-y-5">
    <header className="glass p-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold">Equipe</h1>
        <p className="wd-redundant hint mt-1">Cozinha, garçons e motoboys entram pelo celular e senha</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={copiarLink} className="btn-ghost">{linkCopiado ? <Check size={16} /> : <Copy size={16} />}{linkCopiado ? 'Link copiado' : 'Copiar link de acesso'}</button>
        <button type="button" onClick={abrirNovo} className="btn-primary"><Plus size={16} />Adicionar pessoa</button>
      </div>
    </header>

    {aviso && <div role="status" className="glass p-3 text-sm flex justify-between gap-3"><span>{aviso}</span><button type="button" onClick={() => setAviso('')} aria-label="Fechar aviso"><X size={16} /></button></div>}

    {carregando ? <p className="hint text-center py-8">Carregando…</p> : equipe.length === 0 ? (
      <div className="glass p-10 text-center space-y-3">
        <p className="font-semibold">Nenhuma pessoa na equipe ainda</p>
        <button type="button" onClick={abrirNovo} className="btn-primary mx-auto"><Plus size={16} />Adicionar a primeira pessoa</button>
      </div>
    ) : FUNCOES_EQUIPE.map(funcao => {
      const pessoas = equipe.filter(m => m.role === funcao)
      if (!pessoas.length) return null
      const Icone = ICONE[funcao]
      return <section key={funcao} className="glass p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Icone size={18} />{NOME_FUNCAO[funcao]} <span className="text-sm text-gray-500">({pessoas.length})</span></h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pessoas.map(m => <article key={m.id} className={`rounded-xl border p-4 bg-white ${m.ativo ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{m.nome}</div>
                <div className="text-sm text-gray-500">{formatarCelular(m.telefone)}</div>
                <div className="text-xs mt-1">{!m.ativo ? <span className="text-gray-500">Acesso bloqueado</span> : funcao === 'motoboy' ? <span className={m.disponivel ? 'text-green-700' : 'text-gray-500'}>{m.disponivel ? '● Disponível' : '○ Inativo'}</span> : <span className="text-green-700">Acesso liberado</span>}</div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => abrirEdicao(m)} className="p-2 rounded-lg hover:bg-gray-100" aria-label={`Editar ${m.nome}`}><Pencil size={15} /></button>
                <button type="button" onClick={() => remover(m)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" aria-label={`Remover ${m.nome}`}><Trash2 size={15} /></button>
              </div>
            </div>
            <button type="button" onClick={() => alternarAtivo(m)} className="btn-ghost text-xs mt-3 w-full justify-center">{m.ativo ? 'Bloquear acesso' : 'Liberar acesso'}</button>
          </article>)}
        </div>
      </section>
    })}

    {modo && <section className="glass p-5">
      <h2 className="font-semibold mb-3">Como as entregas chegam aos motoboys</h2>
      <div className="grid sm:grid-cols-3 gap-3">{MODOS_DISTRIBUICAO.map(m => <button type="button" key={m} onClick={() => salvarModo(m)} aria-pressed={modo === m}
        className={`text-left rounded-xl border-2 p-4 ${modo === m ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'}`}>
        <strong className="text-sm">{NOME_MODO[m]}</strong><p className="text-xs text-gray-500 mt-1">{DESCRICAO_MODO[m]}</p>
      </button>)}</div>
    </section>}

    {aberto && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAberto(false)}>
      <form role="dialog" aria-modal="true" aria-label={editando ? 'Editar pessoa da equipe' : 'Adicionar pessoa à equipe'} onSubmit={salvar} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{editando ? `Editar ${editando.nome}` : 'Adicionar pessoa'}</h3><button type="button" onClick={() => setAberto(false)} aria-label="Fechar"><X size={18} /></button></div>
        <label className="block text-sm font-medium">Nome<input className="form-input w-full mt-1" required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
        <label className="block text-sm font-medium">Celular (usado para entrar)<input className="form-input w-full mt-1" required inputMode="tel" placeholder="(11) 99999-9999" disabled={Boolean(editando)} value={form.celular} onChange={e => setForm({ ...form, celular: e.target.value })} /></label>
        <fieldset><legend className="text-sm font-medium mb-1">Função</legend><div className="grid grid-cols-3 gap-2">{FUNCOES_EQUIPE.map(f => {
          const Icone = ICONE[f]
          return <button type="button" key={f} onClick={() => setForm({ ...form, funcao: f })} aria-pressed={form.funcao === f} className={`rounded-xl border-2 p-3 text-sm flex flex-col items-center gap-1 ${form.funcao === f ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}><Icone size={18} />{NOME_FUNCAO[f]}</button>
        })}</div></fieldset>
        <label className="block text-sm font-medium"><span className="flex items-center gap-1"><KeyRound size={14} />{editando ? 'Nova senha (deixe vazio para manter)' : 'Senha'}</span>
          <input className="form-input w-full mt-1" type="text" autoComplete="new-password" minLength={editando ? undefined : SENHA_MINIMA} required={!editando} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder={`Mínimo ${SENHA_MINIMA} caracteres`} />
        </label>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button type="submit" disabled={salvando} className="btn-primary w-full justify-center">{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar'}</button>
      </form>
    </div>}
  </div>
}
