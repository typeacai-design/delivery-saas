'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Trash2, Truck, UtensilsCrossed, ShoppingBag,
  ArrowLeft, X, Minus, MessageSquare, Check, Settings, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { useToast } from '@/components/toast'
import { formatCurrency } from '@/lib/utils'

type TipoEntrega = null | 'delivery' | 'mesa' | 'retirada'
type Etapa = 'inicio' | 'tipo' | 'cliente' | 'mesa' | 'produtos' | 'carrinho' | 'sucesso'
type PerfilMembro = 'attendant' | 'cozinha' | 'motoboy'

interface MembroEquipe {
  id: string
  nome: string
  username: string
  tenant_id: string
  perfil: PerfilMembro
}

interface Categoria { id: string; nome: string; ordem?: number; ativo?: boolean }
interface Produto {
  id: string; nome: string; descricao?: string | null; preco: number
  imagem_url?: string | null; categoria_id?: string | null; ativo?: boolean
}
interface Cliente { id: string; nome: string; telefone: string }
interface ItemCarrinho {
  id: string; nome: string; preco: number; quantidade: number; observacao?: string
}
interface Mesa { id: string; numero: number; pedidos_ativos?: number }

export default function AtendimentoPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [verificandoSessao, setVerificandoSessao] = useState(true)
  const [membroLogado, setMembroLogado] = useState<MembroEquipe | null>(null)
  const [etapa, setEtapa] = useState<Etapa>('inicio')
  const [tipo, setTipo] = useState<TipoEntrega>(null)
  const [loading, setLoading] = useState(false)

  // Dados do dashboard
  const [pedidosHoje, setPedidosHoje] = useState({ novo: 0, preparando: 0, pronto: 0 })
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [tenantId, setTenantId] = useState<string | null>(null)

  // Dados do novo pedido
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null)

  // Cardápio
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)

  // Carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [formaPagamento, setFormaPagamento] = useState<string>('cartao')

  // Resultado
  const [pedidoCriado, setPedidoCriado] = useState<{ id: string; codigo?: string } | null>(null)

  // === Verificação de sessão ===
  useEffect(() => {
    const verificarSessao = async () => {
      const membroStr = localStorage.getItem('membro_equipe')

      if (!membroStr) {
        router.replace('/acesso')
        return
      }

      try {
        const membro: MembroEquipe = JSON.parse(membroStr)

        // Verificar se o perfil é atendimento
        if (membro.perfil !== 'attendant') {
          // Redirecionar para área correta
          if (membro.perfil === 'cozinha') {
            router.replace('/acesso/cozinha')
          } else if (membro.perfil === 'motoboy') {
            router.replace('/acesso/motoboy')
          } else {
            router.replace('/acesso')
          }
          return
        }

        setMembroLogado(membro)

        // Carregar tenant do funcionário
        const t = membro.tenant_id
        if (t) {
          setTenantId(t)
          await carregarDashboard(t)
          await carregarMesas(t)
        }
      } catch {
        localStorage.removeItem('membro_equipe')
        router.replace('/acesso')
        return
      }

      setVerificandoSessao(false)
    }

    verificarSessao()
  }, [router])

  const carregarDashboard = async (t: string) => {
    const sb = createClient()
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const { data } = await sb
      .from('pedidos')
      .select('status')
      .eq('tenant_id', t)
      .gte('data_criacao', hoje.toISOString())
    if (data) {
      const counts = { novo: 0, preparando: 0, pronto: 0 }
      data.forEach((p: any) => {
        if (p.status === 'novo') counts.novo++
        else if (p.status === 'preparando') counts.preparando++
        else if (p.status === 'pronto') counts.pronto++
      })
      setPedidosHoje(counts)
    }
  }

  const carregarMesas = async (t: string) => {
    const sb = createClient()
    const { data: mesasData } = await sb
      .from('mesas')
      .select('id, numero')
      .eq('tenant_id', t)
      .eq('ativo', true)
      .order('numero')
    if (!mesasData) return
    // Buscar pedidos ativos por mesa
    const { data: pedidosData } = await sb
      .from('pedidos')
      .select('mesa_id, status')
      .eq('tenant_id', t)
      .in('status', ['novo', 'preparando', 'pronto'])
    const countPorMesa: Record<string, number> = {}
    pedidosData?.forEach((p: any) => {
      if (p.mesa_id) countPorMesa[p.mesa_id] = (countPorMesa[p.mesa_id] || 0) + 1
    })
    setMesas(mesasData.map((m: any) => ({ ...m, pedidos_ativos: countPorMesa[m.id] || 0 })))
  }

  const logout = () => {
    localStorage.removeItem('membro_equipe')
    router.replace('/acesso')
  }

  const carregarClientes = useCallback(async (busca: string) => {
    if (!tenantId) return
    const sb = createClient()
    let q = sb
      .from('clientes')
      .select('id, nome, telefone')
      .eq('tenant_id', tenantId)
      .order('nome')
      .limit(20)
    if (busca) {
      q = q.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`)
    }
    const { data } = await q
    setClientes(data || [])
  }, [tenantId])

  const carregarCardapio = useCallback(async () => {
    if (!tenantId) return
    const sb = createClient()
    const [{ data: catData }, { data: prodData }] = await Promise.all([
      sb.from('categorias').select('*').eq('tenant_id', tenantId).eq('ativo', true).order('ordem'),
      sb.from('produtos').select('*').eq('tenant_id', tenantId).eq('ativo', true).order('nome'),
    ])
    setCategorias(catData || [])
    setProdutos(prodData || [])
    if (catData && catData.length > 0) setCategoriaAtiva(catData[0].id)
  }, [tenantId])

  // === Fluxo de navegação ===
  const iniciarNovoPedido = () => {
    setTipo(null)
    setClienteSelecionado(null)
    setMesaSelecionada(null)
    setCarrinho([])
    setPedidoCriado(null)
    setEtapa('tipo')
  }

  const selecionarTipo = (t: TipoEntrega) => {
    setTipo(t)
    if (t === 'mesa') {
      setEtapa('mesa')
    } else {
      setEtapa('cliente')
      carregarClientes('')
    }
  }

  const selecionarCliente = (c: Cliente) => {
    setClienteSelecionado(c)
    carregarCardapio()
    setEtapa('produtos')
  }

  const selecionarMesa = (m: Mesa) => {
    setMesaSelecionada(m)
    carregarCardapio()
    setEtapa('produtos')
  }

  // === Carrinho ===
  const adicionarProduto = (p: Produto) => {
    setCarrinho((atual) => {
      const existe = atual.find((i) => i.id === p.id)
      if (existe) {
        return atual.map((i) => i.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...atual, { id: p.id, nome: p.nome, preco: p.preco, quantidade: 1 }]
    })
  }

  const alterarQuantidade = (id: string, delta: number) => {
    setCarrinho((atual) => {
      return atual
        .map((i) => i.id === id ? { ...i, quantidade: i.quantidade + delta } : i)
        .filter((i) => i.quantidade > 0)
    })
  }

  const removerItem = (id: string) => {
    setCarrinho((atual) => atual.filter((i) => i.id !== id))
  }

  const subtotal = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
  const taxaEntrega = tipo === 'delivery' ? 5 : 0
  const total = subtotal + taxaEntrega

  const irParaCarrinho = () => {
    if (carrinho.length === 0) {
      error('Adicione pelo menos um produto')
      return
    }
    setEtapa('carrinho')
  }

  // === Enviar pedido ===
  const enviarPedido = async () => {
    if (!tenantId) return
    if (carrinho.length === 0) return
    setLoading(true)
    try {
      const payload = {
        cliente_id: clienteSelecionado?.id || null,
        cliente_nome: clienteSelecionado?.nome || 'Cliente Balcão',
        cliente_whatsapp: clienteSelecionado?.telefone || '',
        itens: carrinho.map((i) => ({
          produto_id: i.id, nome: i.nome, quantidade: i.quantidade, preco: i.preco, observacao: i.observacao,
        })),
        valor_subtotal: subtotal,
        taxa_entrega: taxaEntrega,
        valor_total: total,
        forma_pagamento: [formaPagamento],
        tipo_entrega: tipo,
        tipo_pedido: tipo === 'delivery' ? 'delivery' : tipo === 'mesa' ? 'mesa' : 'retirada',
        sessao_mesa_id: tipo === 'mesa' ? mesaSelecionada?.id : null,
      }

      // Montar headers com autenticação de funcionário (se logado via /acesso)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const membroStr = localStorage.getItem('membro_equipe')
      if (membroStr) {
        try {
          const membroData = JSON.parse(membroStr)
          // Codificar dados do membro para header
          headers['X-Membro-Equipe'] = Buffer.from(JSON.stringify(membroData)).toString('base64')
        } catch {
          // Ignorar erro de parsing
        }
      }

      const res = await fetch('/api/pedidos/manual', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao criar pedido')
      }
      const data = await res.json()
      setPedidoCriado({ id: data.pedido?.id || '', codigo: data.pedido?.codigo })
      setEtapa('sucesso')
      success('Pedido criado com sucesso!')
      if (tenantId) carregarDashboard(tenantId)
    } catch (e: any) {
      error(e.message || 'Erro ao enviar pedido')
    } finally {
      setLoading(false)
    }
  }

  const voltar = () => {
    if (etapa === 'sucesso') return
    if (etapa === 'carrinho') setEtapa('produtos')
    else if (etapa === 'produtos') setEtapa(tipo === 'mesa' ? 'mesa' : 'cliente')
    else if (etapa === 'mesa' || etapa === 'cliente') setEtapa('tipo')
    else if (etapa === 'tipo') setEtapa('inicio')
  }

  const clientesFiltrados = clientes.filter((c) => {
    if (!buscaCliente) return true
    const b = buscaCliente.toLowerCase()
    return c.nome.toLowerCase().includes(b) || c.telefone.includes(b)
  })

  const produtosFiltrados = categoriaAtiva
    ? produtos.filter((p) => p.categoria_id === categoriaAtiva)
    : produtos

  // Tela de verificação de sessão
  if (verificandoSessao) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--green)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--ink-muted)]">Verificando sessão...</p>
        </div>
      </div>
    )
  }

  // Se não está logado, não mostra nada (redirect está em andamento)
  if (!membroLogado) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--ink-muted)]">Redirecionando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[var(--line)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {etapa !== 'inicio' && etapa !== 'sucesso' && (
            <button onClick={voltar} className="btn-icon-round">
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-lg font-bold">
            {etapa === 'inicio' && 'ATENDIMENTO'}
            {etapa === 'tipo' && 'Novo Pedido'}
            {etapa === 'cliente' && 'Selecionar Cliente'}
            {etapa === 'mesa' && 'Selecionar Mesa'}
            {etapa === 'produtos' && 'Montar Pedido'}
            {etapa === 'carrinho' && 'Finalizar Pedido'}
            {etapa === 'sucesso' && 'Pedido Enviado'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {etapa === 'inicio' && (
            <button onClick={logout} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Sair">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto">
        {/* === TELA INICIAL === */}
        {etapa === 'inicio' && (
          <div className="space-y-5">
            <button
              onClick={iniciarNovoPedido}
              className="w-full bg-gradient-to-br from-[#16A34A] via-[#22C55E] to-[#4ADE80] text-white rounded-2xl p-6 text-center shadow-[var(--shadow-button)] active:scale-[0.98] transition"
            >
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <Plus size={28} className="text-white" />
              </div>
              <div className="text-xl font-bold">NOVO PEDIDO</div>
              <div className="text-sm opacity-90 mt-1">Atendimento rápido no balcão</div>
            </button>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] mt-1 mb-3 flex items-center gap-2">
                PEDIDOS HOJE
              </h2>
              <div className="glass p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl p-3 text-center bg-[var(--green-soft)]">
                    <div className="text-2xl font-bold text-[var(--green)]">{pedidosHoje.novo}</div>
                    <div className="text-xs font-semibold text-[var(--ink-muted)] mt-1">NOVO</div>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-amber-50">
                    <div className="text-2xl font-bold text-amber-600">{pedidosHoje.preparando}</div>
                    <div className="text-xs font-semibold text-[var(--ink-muted)] mt-1">PREPARANDO</div>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-emerald-50">
                    <div className="text-2xl font-bold text-emerald-600">{pedidosHoje.pronto}</div>
                    <div className="text-xs font-semibold text-[var(--ink-muted)] mt-1">PRONTO</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] mt-1 mb-3 flex items-center gap-2">MESAS ATIVAS</h2>
              {mesas.length === 0 ? (
                <div className="glass p-6 text-center text-sm text-[var(--ink-muted)]">
                  Nenhuma mesa cadastrada
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {mesas.slice(0, 8).map((m) => (
                    <div
                      key={m.id}
                      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center ${
                        (m.pedidos_ativos || 0) > 0
                          ? 'bg-[var(--green-soft)] border-[var(--green)]'
                          : 'bg-white border-[var(--line)] opacity-60'
                      }`}
                    >
                      <div className="text-lg font-bold">{m.numero}</div>
                      <div className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                        {(m.pedidos_ativos || 0) > 0 ? `${m.pedidos_ativos} ativo${(m.pedidos_ativos || 0) > 1 ? 's' : ''}` : '---'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* === TELA TIPO === */}
        {etapa === 'tipo' && (
          <div className="space-y-3">
            {[
              { v: 'delivery' as const, label: 'DELIVERY', desc: 'Cliente retira em casa', icon: Truck, cor: 'border-blue-500 bg-blue-50', iconBg: 'bg-blue-500' },
              { v: 'mesa' as const, label: 'MESA', desc: 'Pedido para salão', icon: UtensilsCrossed, cor: 'border-orange-500 bg-orange-50', iconBg: 'bg-orange-500' },
              { v: 'retirada' as const, label: 'RETIRADA', desc: 'Cliente busca na loja', icon: ShoppingBag, cor: 'border-purple-500 bg-purple-50', iconBg: 'bg-purple-500' },
            ].map((op) => (
              <button
                key={op.v}
                onClick={() => selecionarTipo(op.v)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 ${op.cor} active:scale-[0.98] transition`}
              >
                <div className={`w-12 h-12 rounded-full ${op.iconBg} text-white flex items-center justify-center flex-shrink-0`}>
                  <op.icon size={24} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-base">{op.label}</div>
                  <div className="text-sm text-[var(--ink-muted)]">{op.desc}</div>
                </div>
                <div className="text-[var(--ink-muted)]">→</div>
              </button>
            ))}
          </div>
        )}

        {/* === TELA CLIENTE === */}
        {etapa === 'cliente' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                type="text"
                placeholder="Nome ou telefone..."
                value={buscaCliente}
                onChange={(e) => { setBuscaCliente(e.target.value); carregarClientes(e.target.value) }}
                className="w-full pl-11 pr-4 py-3 bg-[var(--bg-2)] border border-[var(--line)] rounded-full text-sm focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green)]/20 outline-none"
              />
            </div>

            <button className="w-full p-3.5 bg-white border-2 border-dashed border-[var(--line)] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-[var(--ink-muted)]">
              <Plus size={18} />
              Novo Cliente
            </button>

            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] mt-4 mb-3 flex items-center gap-2">RECENTES</h3>
            <div className="space-y-2">
              {clientesFiltrados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selecionarCliente(c)}
                  className="w-full flex items-center gap-3 p-3 bg-[var(--bg-2)] rounded-xl hover:bg-[var(--bg-1)] transition"
                >
                  <div className="w-11 h-11 rounded-full bg-[var(--green-soft)] flex items-center justify-center font-bold text-[var(--green)]">
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold">{c.nome}</div>
                    <div className="text-xs text-[var(--ink-muted)]">{c.telefone}</div>
                  </div>
                </button>
              ))}
              {clientesFiltrados.length === 0 && (
                <div className="text-center text-sm text-[var(--ink-muted)] py-8">
                  Nenhum cliente encontrado
                </div>
              )}
            </div>
          </div>
        )}

        {/* === TELA MESA === */}
        {etapa === 'mesa' && (
          <div className="space-y-4">
            <p className="text-center text-sm text-[var(--ink-muted)]">Escolha a mesa para este pedido</p>
            {mesas.length === 0 ? (
              <div className="glass p-6 text-center text-sm text-[var(--ink-muted)]">
                Nenhuma mesa cadastrada
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {mesas.map((m) => {
                  const selecionada = mesaSelecionada?.id === m.id
                  const ativa = (m.pedidos_ativos || 0) > 0
                  return (
                    <button
                      key={m.id}
                      onClick={() => selecionarMesa(m)}
                      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition active:scale-95 ${
                        selecionada
                          ? 'bg-[var(--green-soft)] border-[var(--green)]'
                          : ativa
                          ? 'bg-[var(--green-soft)] border-[var(--green)]'
                          : 'bg-white border-[var(--line)]'
                      }`}
                    >
                      <div className="text-xl font-bold">{m.numero}</div>
                      <div className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                        {ativa ? `${m.pedidos_ativos} ativo${(m.pedidos_ativos || 0) > 1 ? 's' : ''}` : '---'}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {mesaSelecionada && (
              <button onClick={() => setEtapa('produtos')} className="btn-primary w-full justify-center">
                CONTINUAR
              </button>
            )}
          </div>
        )}

        {/* === TELA PRODUTOS === */}
        {etapa === 'produtos' && (
          <div>
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {tipo === 'mesa' ? `Mesa ${mesaSelecionada?.numero}` : clienteSelecionado?.nome}
              </span>
              {tipo && (
                <span className={`chip ${
                  tipo === 'delivery' ? 'bg-blue-100 text-blue-700' :
                  tipo === 'mesa' ? 'bg-orange-100 text-orange-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {tipo === 'delivery' && '🚗 Delivery'}
                  {tipo === 'mesa' && '🍽️ Mesa'}
                  {tipo === 'retirada' && '📦 Retirada'}
                </span>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
              {categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoriaAtiva(c.id)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                    categoriaAtiva === c.id ? 'bg-[var(--green)] text-white' : 'bg-[var(--bg-2)]'
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {produtosFiltrados.map((p) => (
                <div key={p.id} className="glass p-4 flex gap-3">
                  <div className="w-20 h-20 rounded-xl bg-[var(--bg-2)] flex items-center justify-center text-3xl flex-shrink-0">
                    🍽️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{p.nome}</div>
                    {p.descricao && (
                      <div className="text-xs text-[var(--ink-muted)] mt-0.5 line-clamp-1">{p.descricao}</div>
                    )}
                    <div className="text-base font-bold text-[var(--green)] mt-1">{formatCurrency(p.preco)}</div>
                  </div>
                  <button
                    onClick={() => adicionarProduto(p)}
                    className="self-end px-4 py-2 bg-[var(--green)] text-white rounded-full text-sm font-semibold active:scale-95 transition"
                  >
                    +
                  </button>
                </div>
              ))}
              {produtosFiltrados.length === 0 && (
                <div className="text-center text-sm text-[var(--ink-muted)] py-8">
                  Nenhum produto nesta categoria
                </div>
              )}
            </div>

            {carrinho.length > 0 && (
              <button
                onClick={irParaCarrinho}
                className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-black text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl active:scale-[0.98] transition z-20"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-[var(--green)] rounded-full flex items-center justify-center text-xs font-bold">
                    {carrinho.reduce((a, i) => a + i.quantidade, 0)}
                  </span>
                  <span className="font-semibold">Ver pedido</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] opacity-80">Total</div>
                  <div className="text-base font-bold">{formatCurrency(total)}</div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* === TELA CARRINHO === */}
        {etapa === 'carrinho' && (
          <div className="space-y-4">
            <div className="space-y-0">
              {carrinho.map((item) => (
                <div key={item.id} className="py-4 border-b border-[var(--line)]">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{item.quantidade}x {item.nome}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => alterarQuantidade(item.id, -1)} className="w-7 h-7 rounded-full border border-[var(--line)] flex items-center justify-center active:scale-95">
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-semibold min-w-[20px] text-center">{item.quantidade}</span>
                        <button onClick={() => alterarQuantidade(item.id, +1)} className="w-7 h-7 rounded-full border border-[var(--line)] flex items-center justify-center active:scale-95">
                          <Plus size={14} />
                        </button>
                        <button onClick={() => removerItem(item.id)} className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center ml-auto active:scale-95">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="font-bold text-sm">{formatCurrency(item.preco * item.quantidade)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[var(--bg-2)] rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {taxaEntrega > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Taxa entrega</span>
                  <span>{formatCurrency(taxaEntrega)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-[var(--line)]">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Forma de pagamento</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'dinheiro', l: 'DINHEIRO' },
                  { v: 'cartao', l: 'CARTÃO' },
                  { v: 'pix', l: 'PIX' },
                ].map((fp) => (
                  <button
                    key={fp.v}
                    onClick={() => setFormaPagamento(fp.v)}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition ${
                      formaPagamento === fp.v
                        ? 'bg-[var(--green-soft)] border-[var(--green)] text-[var(--green)]'
                        : 'bg-[var(--bg-2)] border-transparent'
                    }`}
                  >
                    {fp.l}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={enviarPedido}
              disabled={loading}
              className="w-full py-4 bg-[var(--green)] text-white rounded-full font-bold text-base shadow-[var(--shadow-button)] active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <MessageSquare size={20} />
              {loading ? 'Enviando...' : 'ENVIAR PEDIDO'}
            </button>
            <button
              onClick={() => setEtapa('produtos')}
              className="w-full py-4 bg-[var(--bg-2)] text-[var(--ink-muted)] rounded-full font-semibold"
            >
              CONTINUAR ADICIONANDO
            </button>
          </div>
        )}

        {/* === TELA SUCESSO === */}
        {etapa === 'sucesso' && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center py-8">
            <div className="w-20 h-20 rounded-full bg-[var(--green-soft)] flex items-center justify-center mb-5">
              <Check size={40} className="text-[var(--green)]" strokeWidth={3} />
            </div>
            <div className="text-2xl font-bold mb-2">PEDIDO ENVIADO!</div>
            {pedidoCriado?.codigo && (
              <div className="text-3xl font-bold text-[var(--green)] mb-4">#{pedidoCriado.codigo}</div>
            )}
            <div className="text-sm text-[var(--ink-muted)] mb-6">
              {clienteSelecionado?.nome || 'Cliente Balcão'}<br />
              {tipo === 'delivery' && '🚗 Delivery'}{tipo === 'mesa' && `🍽️ Mesa ${mesaSelecionada?.numero}`}{tipo === 'retirada' && '📦 Retirada'}
              <br />
              {formatCurrency(total)}
            </div>
            <div className="bg-[var(--green-soft)] px-6 py-3 rounded-full mb-8">
              <div className="text-xs text-[var(--ink-muted)] uppercase">Status atual</div>
              <div className="text-lg font-bold text-[var(--green)]">🟢 NOVO</div>
            </div>
            <div className="w-full max-w-xs space-y-3">
              <button onClick={iniciarNovoPedido} className="w-full py-4 bg-[var(--green)] text-white rounded-full font-bold flex items-center justify-center gap-2 shadow-[var(--shadow-button)]">
                <Plus size={20} />
                NOVO PEDIDO
              </button>
              <button onClick={() => setEtapa('inicio')} className="w-full py-4 bg-[var(--bg-2)] text-[var(--ink-muted)] rounded-full font-semibold">
                TELA INICIAL
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
