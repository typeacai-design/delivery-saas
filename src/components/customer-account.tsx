'use client'

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Customer = Record<string, string | undefined> & { whatsapp?: string; accessToken?: string }
type OrderItem = { nome: string; quantidade: number; variante_nome?: string | null }
type Order = { id: string; status: string; created_at: string; valor_total: number; pedido_itens?: OrderItem[] }

const statusLabels: Record<string, string> = {
  novo: 'Recebido', recebido: 'Recebido', preparando: 'Em preparação', preparacao: 'Em preparação',
  em_preparo: 'Em preparação', pronto: 'Pronto', saiu_entrega: 'Saiu para entrega',
  saiu_para_entrega: 'Saiu para entrega', em_entrega: 'Saiu para entrega', entregue: 'Entregue',
}
const customerKey = (slug: string) => `delivery_cliente_dados_${slug}`
function formatDate(value: string | undefined) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
function validDate(value: string | undefined) {
  if (!value) return true
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return false
  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  const date = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso && date <= new Date()
}
function isoDate(value: string | undefined) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '')
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}
function validCpf(value: string | undefined) {
  const cpf = (value || '').replace(/\D/g, '')
  if (!cpf) return true
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (size: number) => { let sum = 0; for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i); const result = (sum * 10) % 11; return result === 10 ? 0 : result }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export function CustomerOrders({ slug, cliente }: { slug: string; cliente: Customer }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [message, setMessage] = useState(cliente.whatsapp && cliente.accessToken ? 'Carregando…' : 'Finalize seu primeiro pedido neste aparelho para acompanhar o histórico.')

  useEffect(() => {
    if (!cliente.whatsapp || !cliente.accessToken) return
    const query = new URLSearchParams({ tenant_slug: slug })
    const load = () => fetch(`/api/pedidos/public?${query}`, {
      headers: { Authorization: `Bearer ${cliente.accessToken}` }, cache: 'no-store',
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setOrders(body.pedidos || []); setMessage('')
    }).catch(() => setMessage('Não foi possível consultar seus pedidos.'))
    load(); const timer = window.setInterval(load, 30_000)
    return () => window.clearInterval(timer)
  }, [slug, cliente.whatsapp, cliente.accessToken])

  return <section className="px-4 py-5 pb-24"><h2 className="text-2xl font-bold mb-4">Meus pedidos</h2>
    {message && <p className="text-gray-500">{message}</p>}
    <div className="space-y-3">{orders.map(order => <article key={order.id} className="bg-white border rounded-2xl p-4">
      <div className="flex justify-between"><strong>#{order.id.slice(0, 8)}</strong><span className="text-sm font-semibold text-green-700">{statusLabels[order.status] || order.status}</span></div>
      <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
      <div className="mt-3">{(order.pedido_itens || []).map((item, index) => <p className="text-sm" key={index}>{item.quantidade}× {item.nome}{item.variante_nome ? ` — ${item.variante_nome}` : ''}</p>)}</div>
      <p className="font-bold mt-3">{formatCurrency(Number(order.valor_total))}</p>
    </article>)}</div>
  </section>
}

export function CustomerProfile({ slug, cliente, setCliente }: { slug: string; cliente: Customer; setCliente: React.Dispatch<React.SetStateAction<Customer>> }) {
  const [draft, setDraft] = useState<Customer>(cliente)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    if (!cliente.accessToken) { setMessage('Finalize seu primeiro pedido neste aparelho para ativar o perfil.'); return }
    if (!validCpf(draft.cpf)) { setMessage('Informe um CPF válido ou deixe o campo vazio.'); return }
    if (!validDate(draft.aniversario)) { setMessage('Informe o aniversário no formato DD/MM/AAAA ou deixe vazio.'); return }
    setSaving(true); setMessage('')
    const response = await fetch('/api/clientes/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      tenant_slug: slug, nome: draft.nome, telefone: draft.whatsapp, data_nascimento: isoDate(draft.aniversario),
      cpf: draft.cpf || null, endereco: [draft.endereco, draft.numero, draft.complemento].filter(Boolean).join(', '), access_token: cliente.accessToken,
    }) })
    const body = await response.json(); setSaving(false)
    if (!response.ok) { setMessage(body.error || 'Não foi possível salvar.'); return }
    const committed = { ...draft, accessToken: cliente.accessToken, tenantSlug: slug }
    setCliente(committed); localStorage.setItem(customerKey(slug), JSON.stringify(committed))
    window.dispatchEvent(new Event('delivery-cliente-updated')); setMessage('Perfil atualizado.')
  }

  const fields = [['nome','Nome'],['whatsapp','WhatsApp'],['cpf','CPF (opcional)'],['endereco','Endereço'],['numero','Número'],['bairro','Bairro'],['complemento','Complemento'],['aniversario','Aniversário']]
  return <section className="px-4 py-5 pb-24"><h2 className="text-2xl font-bold mb-4">Meu perfil</h2><div className="bg-white border rounded-2xl p-4 space-y-3">
    {fields.map(([key,label]) => <label key={key} className="block text-sm font-medium">{label}<input inputMode={key === 'cpf' || key === 'aniversario' ? 'numeric' : undefined} maxLength={key === 'aniversario' ? 10 : undefined} placeholder={key === 'aniversario' ? 'DD/MM/AAAA' : undefined} value={draft[key] || ''} onChange={event => setDraft(current => ({ ...current, [key]: key === 'cpf' ? event.target.value.replace(/\D/g, '').slice(0, 11) : key === 'aniversario' ? formatDate(event.target.value) : event.target.value }))} className="mt-1 w-full border rounded-xl px-3 py-2.5" /></label>)}
    {message && <p className="text-sm">{message}</p>}<button onClick={save} disabled={saving} className="w-full rounded-xl bg-green-600 text-white py-3 font-bold flex justify-center gap-2"><Save size={18}/>{saving ? 'Salvando…' : 'Salvar perfil'}</button>
  </div></section>
}
