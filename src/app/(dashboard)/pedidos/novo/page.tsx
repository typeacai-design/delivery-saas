'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { ArrowLeft, ShoppingBag, MapPin, CreditCard, Plus, Trash2, Check, MessageCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Cliente {
  id: string
  nome: string
  telefone: string
  endereco?: string
  bairro?: string
}

interface Produto {
  id: string
  nome: string
  preco: number
  imagem_url?: string
}

interface ItemPedido {
  produto_id: string
  nome: string
  quantidade: number
  valor_unitario: number
}

export default function NovoPedidoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [formaPagamento, setFormaPagamento] = useState<string>('dinheiro')
  const [valorPago, setValorPago] = useState('')
  const [troco, setTroco] = useState(0)
  const [observacoes, setObservacoes] = useState('')
  const [taxaEntrega, setTaxaEntrega] = useState(0)
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [enderecoEntrega, setEnderecoEntrega] = useState('')
  const [pedidoCriado, setPedidoCriado] = useState<any>(null)
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [whatsappMsg, setWhatsappMsg] = useState('')

  // Busca clientes e produtos ao carregar
  useEffect(() => {
    loadDados()
  }, [])

  // Calcula troco automaticamente
  useEffect(() => {
    const total = calcularTotal()
    const pago = parseFloat(valorPago) || 0
    if (pago > total) {
      setTroco(pago - total)
    } else {
      setTroco(0)
    }
  }, [valorPago, itens, taxaEntrega])

  const loadDados = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) return

    // Carregar clientes
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nome')

    // Carregar produtos
    const { data: produtosData } = await supabase
      .from('produtos')
      .select('id, nome, preco, imagem_url')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('nome')

    setClientes(clientesData || [])
    setProdutos(produtosData || [])
  }

  const adicionarItem = (produto: Produto) => {
    const existente = itens.find(i => i.produto_id === produto.id)
    if (existente) {
      setItens(itens.map(i =>
        i.produto_id === produto.id
          ? { ...i, quantidade: i.quantidade + 1 }
          : i
      ))
    } else {
      setItens([...itens, {
        produto_id: produto.id,
        nome: produto.nome,
        quantidade: 1,
        valor_unitario: produto.preco,
      }])
    }
  }

  const atualizarQuantidade = (produtoId: string, quantidade: number) => {
    if (quantidade <= 0) {
      setItens(itens.filter(i => i.produto_id !== produtoId))
    } else {
      setItens(itens.map(i =>
        i.produto_id === produtoId ? { ...i, quantidade } : i
      ))
    }
  }

  const removerItem = (produtoId: string) => {
    setItens(itens.filter(i => i.produto_id !== produtoId))
  }

  const calcularTotal = () => {
    const subtotal = itens.reduce((acc, item) => acc + (item.valor_unitario * item.quantidade), 0)
    return subtotal + taxaEntrega
  }

  const criarPedido = async () => {
    if (itens.length === 0) {
      alert('Adicione pelo menos um item ao pedido')
      return
    }

    if (!clienteSelecionado) {
      alert('Selecione um cliente')
      return
    }

    setLoading(true)

    try {
      const tenantId = await activeTenantId()
      if (!tenantId) throw new Error('Não autenticado')

      const total = calcularTotal()
      const pago = parseFloat(valorPago) || total

      // Criar pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          tenant_id: tenantId,
          cliente_id: clienteSelecionado.id,
          status: 'novo',
          valor_total: total,
          taxa_entrega: taxaEntrega,
          forma_pagamento: [formaPagamento],
          valor_pago: [pago],
          troco: troco,
          observacoes: observacoes,
        })
        .select()
        .single()

      if (pedidoError) throw pedidoError

      // Criar itens do pedido
      const itensParaInserir = itens.map(item => ({
        pedido_id: pedido.id,
        produto_id: item.produto_id,
        nome: item.nome,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
      }))

      await supabase
        .from('pedido_itens')
        .insert(itensParaInserir)

      // Buscar tempo de preparo do pedido (máximo dos produtos)
      const { data: produtosData } = await supabase
        .from('produtos')
        .select('tempo_preparo_min')
        .eq('tenant_id', tenantId)
        .in('id', itens.map(i => i.produto_id))

      const tempoMax = produtosData
        ? Math.max(...produtosData.map(p => Number(p.tempo_preparo_min) || 30), 30)
        : 30

      // Gerar mensagem WhatsApp
      const whatsappRes = await fetch('/api/whatsapp-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedido.id,
          tempo_preparo: tempoMax,
          forma_pagamento: [formaPagamento],
        }),
      })
      const whatsappData = await whatsappRes.json()

      setPedidoCriado(pedido)
      setWhatsappUrl(whatsappData.whatsapp_url || '')
      setWhatsappMsg(whatsappData.mensagem || '')

    } catch (error: any) {
      console.error(error)
      alert('Erro ao criar pedido: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const copiarMsg = () => {
    navigator.clipboard.writeText(whatsappMsg)
  }

  const novoPedido = () => {
    setPedidoCriado(null)
    setWhatsappUrl('')
    setWhatsappMsg('')
    setItens([])
    setClienteSelecionado(null)
    setFormaPagamento('dinheiro')
    setValorPago('')
    setTroco(0)
    setObservacoes('')
    setTaxaEntrega(0)
  }

  const total = calcularTotal()
  const clienteNovo = clientes.length === 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="eyebrow mb-2">Novo Pedido</div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
          Lançar Pedido
        </h1>
        <p className="hint">Registre um pedido realizado presencialmente ou por telefone</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda - Cliente e Endereço */}
        <div className="lg:col-span-1 space-y-6">
          {/* Cliente */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-green-600" />
              Cliente
            </h3>

            {clienteNovo ? (
              <div className="text-center py-6 text-gray-500">
                <p className="mb-2">Nenhum cliente cadastrado</p>
                <p className="text-sm">Cadastre clientes pelo Marketing para usar aqui</p>
              </div>
            ) : (
              <select
                value={clienteSelecionado?.id || ''}
                onChange={(e) => {
                  const cliente = clientes.find(c => c.id === e.target.value)
                  setClienteSelecionado(cliente || null)
                  if (cliente?.endereco) {
                    setEnderecoEntrega(`${cliente.endereco}${cliente.bairro ? `, ${cliente.bairro}` : ''}`)
                  }
                }}
                className="w-full"
              >
                <option value="">Selecione um cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome} - {cliente.telefone}
                  </option>
                ))}
              </select>
            )}

            {clienteSelecionado && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="font-medium">{clienteSelecionado.nome}</p>
                <p className="text-sm text-gray-600">{clienteSelecionado.telefone}</p>
                {clienteSelecionado.endereco && (
                  <p className="text-sm text-gray-600">{clienteSelecionado.endereco}</p>
                )}
              </div>
            )}
          </div>

          {/* Endereço */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Endereço de Entrega
            </h3>

            <textarea
              value={enderecoEntrega}
              onChange={(e) => setEnderecoEntrega(e.target.value)}
              placeholder="Rua, número, bairro..."
              rows={3}
              className="w-full"
            />

            <div className="mt-4">
              <label className="mb-2">Taxa de entrega</label>
              <input
                type="number"
                step="0.01"
                value={taxaEntrega || ''}
                onChange={(e) => setTaxaEntrega(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full"
              />
            </div>
          </div>

          {/* Pagamento */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Pagamento
            </h3>

            <div className="space-y-3">
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="w-full"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
              </select>

              {formaPagamento === 'dinheiro' && (
                <>
                  <div>
                    <label className="mb-2">Valor pago</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorPago}
                      onChange={(e) => setValorPago(e.target.value)}
                      placeholder="0,00"
                      className="w-full"
                    />
                  </div>

                  {troco > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        Troco para: <strong>{formatCurrency(parseFloat(valorPago))}</strong>
                      </p>
                      <p className="font-semibold text-amber-900">
                        Troco: {formatCurrency(troco)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-4">Observações</h3>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Sem cebola, ponto da carne..."
              rows={2}
              className="w-full"
            />
          </div>
        </div>

        {/* Coluna direita - Produtos */}
        <div className="lg:col-span-2">
          <div className="glass p-5">
            <h3 className="font-semibold mb-4">Produtos</h3>

            {/* Lista de produtos */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {produtos.map(produto => (
                <button
                  key={produto.id}
                  onClick={() => adicionarItem(produto)}
                  className="p-3 border rounded-xl text-left hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">{produto.nome}</span>
                    <Plus className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-green-600 font-semibold text-sm mt-1">
                    {formatCurrency(produto.preco)}
                  </p>
                </button>
              ))}
            </div>

            {produtos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum produto cadastrado</p>
                <p className="text-sm">Cadastre produtos no Cardápio primeiro</p>
              </div>
            )}

            {/* Itens no pedido */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3">
                Itens do Pedido ({itens.length})
              </h4>

              {itens.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Adicione produtos ao pedido</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itens.map(item => (
                    <div
                      key={item.produto_id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(item.valor_unitario)} cada
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => atualizarQuantidade(item.produto_id, item.quantidade - 1)}
                          className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-200"
                        >
                          -
                        </button>
                        <span className="font-semibold w-6 text-center">{item.quantidade}</span>
                        <button
                          onClick={() => atualizarQuantidade(item.produto_id, item.quantidade + 1)}
                          className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-200"
                        >
                          +
                        </button>
                      </div>

                      <p className="font-semibold text-green-600 w-20 text-right">
                        {formatCurrency(item.valor_unitario * item.quantidade)}
                      </p>

                      <button
                        onClick={() => removerItem(item.produto_id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totais */}
            {itens.length > 0 && (
              <div className="border-t mt-6 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total - taxaEntrega)}</span>
                </div>
                {taxaEntrega > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega</span>
                    <span>{formatCurrency(taxaEntrega)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                  <span>Total</span>
                  <span style={{ color: 'var(--green)' }}>{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Botão Finalizar */}
          <button
            onClick={criarPedido}
            disabled={loading || itens.length === 0}
            className="btn-primary w-full mt-6 py-4 text-lg disabled:opacity-50"
          >
            {loading ? (
              'Criando...'
            ) : (
              <>
                <Check className="w-5 h-5" />
                Finalizar Pedido
              </>
            )}
          </button>
        </div>
      </div>

      {/* ✅ TELA DE SUCESSO COM WHATSAPP */}
      {pedidoCriado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-3xl p-8 w-full max-w-lg text-center">
            <div className="size-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}>
              <Check size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
              Pedido #{pedidoCriado.id.split('-')[0].toUpperCase()} criado!
            </h2>
            <p className="hint mb-6">{clienteSelecionado?.nome} • {formatCurrency(pedidoCriado.valor_total)}</p>

            {whatsappMsg && (
              <div className="glass-soft p-4 rounded-2xl text-left mb-6" style={{ background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.25)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: '#25D162' }}>📱 Mensagem WhatsApp</div>
                <pre className="text-xs whitespace-pre-wrap break-all font-mono" style={{ color: 'var(--ink-muted)', maxHeight: 200, overflowY: 'auto' }}>
                  {whatsappMsg}
                </pre>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={copiarMsg}
                className="flex-1 btn-ghost justify-center"
              >
                📋 Copiar mensagem
              </button>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium text-white transition"
                  style={{ background: '#25D162', boxShadow: '0 4px 14px rgba(37,211,102,.4)' }}
                >
                  <MessageCircle size={18} />
                  Abrir WhatsApp
                </a>
              )}
            </div>

            <button
              onClick={novoPedido}
              className="mt-4 text-sm hint hover:underline"
            >
              ← Lançar outro pedido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


