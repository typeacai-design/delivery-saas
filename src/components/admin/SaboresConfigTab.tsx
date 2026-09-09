'use client'

import { useEffect, useState } from 'react'

export default function SaboresConfigTab() {
  const [ativo, setAtivo] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [produtos, setProdutos] = useState<Array<{ id: string; nome: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    fetch('/api/configuracoes/sabores', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a configuração.')
        setAtivo(data.sabores_ativo === true)
        setSalvo(data.sabores_ativo === true)
        setProdutos(data.produtos || [])
      }).catch(error => setError(error.message)).finally(() => setLoading(false))
  }, [])
  async function salvar() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const response = await fetch('/api/configuracoes/sabores', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sabores_ativo: ativo }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.')
      setSalvo(ativo); setSuccess('Configuração salva.')
    } catch (error: any) { setError(error.message) } finally { setSaving(false) }
  }
  if (loading) return <p className="text-sm text-gray-500">Carregando configuração de sabores...</p>
  return <div className="bg-white rounded-2xl border p-6 max-w-3xl space-y-4">
    <h2 className="text-lg font-semibold">Divisão em sabores</h2>
    <p className="text-sm text-gray-600">Permita pizzas com até dois ou três sabores, cobrando a média dos preços escolhidos. A função é opcional e vale somente para os produtos que você configurar.</p>
    <label className="flex items-center gap-3 font-medium text-sm">
      <input type="checkbox" checked={ativo} onChange={e => { setAtivo(e.target.checked); setSuccess('') }} disabled={saving} />
      Ativar divisão em sabores nesta loja
    </label>
    <p className="text-sm text-gray-600">Depois de ativar, abra Cardápio → editar produto → Divisão em sabores. Escolha a lista e o máximo de sabores. Os preços continuam cadastrados nos complementos.</p>
    {!ativo && produtos.length > 0 && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
      <p className="font-medium">{salvo ? 'Ao desativar, estes produtos ficarão indisponíveis para novas vendas:' : 'Estes produtos estão indisponíveis enquanto a função estiver desligada:'}</p>
      <ul className="list-disc ml-5 mt-2">{produtos.map(p => <li key={p.id}>{p.nome}</li>)}</ul>
      <p className="mt-2">Pedidos e impressões existentes mantêm os sabores e valores originais. A configuração de cada produto será preservada.</p>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="text-sm text-green-700">{success}</p>}
    <button className="btn-primary" onClick={salvar} disabled={saving || ativo === salvo}>{saving ? 'Salvando...' : 'Salvar configuração'}</button>
  </div>
}
