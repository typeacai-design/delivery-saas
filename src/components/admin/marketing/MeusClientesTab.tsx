'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Search, Phone, MapPin, ShoppingBag, Calendar, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function MeusClientesTab() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [pedidosCliente, setPedidosCliente] = useState<any[]>([])
  const [pontos, setPontos] = useState<Record<string, { pontos: number; cashback: number }>>({})

  useEffect(() => {
    carregar()
  }, [])

  const carregar = async () => {
    setLoading(true)
    const r = await fetch('/api/auth/session', { cache: 'no-store' })
    const s = await r.json()
    const tid = s.tenant?.id
    if (!tid) { setLoading(false); return }

    // Clientes com pontos + cashback
    const [{ data: cls }, { data: pts }] = await Promise.all([
      supabase.from('clientes').select('id, nome, telefone, email, bairro, endereco, cpf, data_nascimento, total_pedidos, saldo_cashback, ltv, created_at, tags').eq('tenant_id', tid).order('nome'),
      supabase.from('cliente_pontos').select('cliente_id, saldo, saldo_cashback').eq('tenant_id', tid)
    ])
    setClientes(cls || [])
    const pontosMap: Record<string, { pontos: number; cashback: number }> = {}
    pts?.forEach((p: any) => {
      pontosMap[p.cliente_id] = { pontos: Number(p.saldo) || 0, cashback: Number(p.saldo_cashback) || 0 }
    })
    setPontos(pontosMap)
    setLoading(false)
  }

  const expandir = async (clienteId: string) => {
    if (expandido === clienteId) {
      setExpandido(null)
      setPedidosCliente([])
      return
    }
    setExpandido(clienteId)
    setPedidosCliente([])

    // Buscar pedidos do cliente
    const { data } = await supabase
      .from('pedidos')
      .select('id, codigo, status, valor_total, data_criacao, forma_pagamento')
      .eq('cliente_id', clienteId)
      .order('data_criacao', { ascending: false })
      .limit(20)
    setPedidosCliente(data || [])
  }

  const clientesFiltrados = useMemo(() => {
    if (!busca) return clientes
    const b = busca.toLowerCase()
    return clientes.filter((c) =>
      (c.nome || '').toLowerCase().includes(b) ||
      (c.telefone || '').includes(b) ||
      (c.email || '').toLowerCase().includes(b) ||
      (c.cpf || '').includes(b) ||
      (c.endereco || '').toLowerCase().includes(b) ||
      (c.bairro || '').toLowerCase().includes(b)
    )
  }, [clientes, busca])

  const totalPontos = Object.values(pontos).reduce((acc, p) => acc + p.pontos, 0)
  const totalCashback = Object.values(pontos).reduce((acc, p) => acc + p.cashback, 0)

  if (loading) return <div className="text-center py-8 hint">Carregando clientes...</div>

  return (
    <div className="space-y-5">
      {/* RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-5">
          <p className="text-sm text-blue-700 font-medium">Total de clientes</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{clientes.length}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-2xl p-5">
          <p className="text-sm text-yellow-700 font-medium">⭐ Pontos em circulação</p>
          <p className="text-3xl font-bold text-yellow-900 mt-1">{totalPontos.toFixed(0)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-2xl p-5">
          <p className="text-sm text-green-700 font-medium">💰 Cashback disponível</p>
          <p className="text-3xl font-bold text-green-900 mt-1">{formatCurrency(totalCashback)}</p>
        </div>
      </div>

      {/* BUSCA */}
      <div className="bg-white rounded-2xl border p-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, email, CPF, endereço..."
            className="form-input w-full pl-10"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {clientesFiltrados.length} de {clientes.length} clientes
        </p>
      </div>

      {/* LISTA */}
      <div className="space-y-2">
        {clientesFiltrados.map((c) => {
          const pts = pontos[c.id] || { pontos: 0, cashback: 0 }
          const expandidoAt = expandido === c.id
          return (
            <div key={c.id} className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
              <div
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                onClick={() => expandir(c.id)}
              >
                <div className="size-12 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--green)' }}>
                  {(c.nome || 'C').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{c.nome}</div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-3 mt-0.5">
                    {c.telefone && <span><Phone className="w-3 h-3 inline" /> {c.telefone}</span>}
                    {c.bairro && <span><MapPin className="w-3 h-3 inline" /> {c.bairro}</span>}
                    <span><ShoppingBag className="w-3 h-3 inline" /> {c.total_pedidos || 0} pedido(s)</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    <span className="font-bold text-yellow-600">⭐ {pts.pontos}</span>
                    {pts.cashback > 0 && <span className="ml-2 font-bold text-green-600">{formatCurrency(pts.cashback)}</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    Cadastrado {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  {expandidoAt ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {expandidoAt && (
                <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                  {/* Detalhes cadastro */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {c.email && <div><span className="font-medium">Email:</span> {c.email}</div>}
                    {c.cpf && <div><span className="font-medium">CPF:</span> {c.cpf}</div>}
                    {c.data_nirthamento && <div><span className="font-medium">Nascimento:</span> {new Date(c.data_nascimento).toLocaleDateString('pt-BR')}</div>}
                    {c.endereco && <div className="md:col-span-2"><span className="font-medium">Endereço:</span> {c.endereco}</div>}
                    {c.ltv && <div><span className="font-medium">LTV (valor total):</span> {formatCurrency(Number(c.ltv))}</div>}
                  </div>

                  {/* Histórico de pedidos */}
                  <div className="border-t pt-3">
                    <h4 className="font-semibold text-sm mb-2">📋 Histórico de pedidos ({pedidosCliente.length})</h4>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {pedidosCliente.length === 0 ? (
                        <p className="text-xs text-gray-500">Nenhum pedido encontrado</p>
                      ) : (
                        pedidosCliente.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg text-xs">
                            <span className="font-mono font-bold">{p.codigo || `#${p.id.slice(0, 8)}`}</span>
                            <span className="text-gray-500">{new Date(p.data_criacao).toLocaleDateString('pt-BR')}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'entregue' ? 'bg-gray-100 text-gray-700' :
                              p.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                                p.status === 'novo' ? 'bg-orange-100 text-orange-700' :
                                  'bg-blue-100 text-blue-700'}`}>
                              {p.status}
                            </span>
                            <span className="font-bold text-green-600">{formatCurrency(Number(p.valor_total))}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Saldo de pontos/cashback */}
                  <div className="border-t pt-3 grid grid-cols-2 gap-3">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                      <p className="text-xs text-yellow-700">⭐ Pontos acumulados</p>
                      <p className="text-2xl font-bold text-yellow-900">{pts.pontos}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <p className="text-xs text-green-700">💰 Cashback disponível</p>
                      <p className="text-2xl font-bold text-green-900">{formatCurrency(pts.cashback)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {clientesFiltrados.length === 0 && (
          <div className="text-center py-12 hint">
            {busca ? `Nenhum cliente encontrado para "${busca}"` : 'Nenhum cliente cadastrado ainda'}
          </div>
        )}
      </div>
    </div>
  )
}