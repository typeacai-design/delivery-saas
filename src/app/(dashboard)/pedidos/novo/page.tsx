'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { ArrowLeft, ShoppingBag, MapPin, CreditCard, Plus, Trash2, Check, MessageCircle, User, Phone, Calendar, Home, Store, Table2, Save, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Cliente {
  id: string
  nome: string
  telefone: string
  cpf?: string
  data_nascimento?: string
  endereco?: string
  bairro?: string
  numero?: string
  complemento?: string
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
  complementos?: any[]
  observacao?: string
}

interface Bairro {
  id: string
  bairro: string
  taxa: number
  prazo_min?: number
}

interface Complemento {
  id: string
  nome: string
  preco: number
  categoria_id: string
}

export default function NovoPedidoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [complementos, setComplementos] = useState<Complemento[]>([])
  const [categoriasComplementos, setCategoriasComplementos] = useState<any[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [pedidoCriado, setPedidoCriado] = useState<any>(null)
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [whatsappMsg, setWhatsappMsg] = useState('')

  // Tipo de entrega
  const [tipoEntrega, setTipoEntrega] = useState<'delivery' | 'retirada' | 'mesa'>('delivery')

  // Cliente
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false)
  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    telefone: '',
    cpf: '',
    data_nascimento: '',
    endereco: '',
    bairro: '',
    numero: '',
    complemento: ''
  })

  // Campos do pedido
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [bairroSelecionado, setBairroSelecionado] = useState<Bairro | null>(null)
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<string>('dinheiro')
  const [valorPago, setValorPago] = useState('')
  const [troco, setTroco] = useState(0)
  const [observacoes, setObservacoes] = useState('')
  const [ajusteValor, setAjusteValor] = useState<number>(0) // positivo = desconto, negativo = acréscimo
  const [motivoAjuste, setMotivoAjuste] = useState('')

  // Modal de complementos
  const [itemSelecionandoComps, setItemSelecionandoComps] = useState<string | null>(null)
  const [complementosSelecionados, setComplementosSelecionados] = useState<Complemento[]>([])
  const [categoriaFiltroComp, setCategoriaFiltroComp] = useState('')

  // Busca clientes, produtos e bairros
  useEffect(() => {
    loadDados()
  }, [])

  // Calcula troco
  useEffect(() => {
    const total = calcularTotal()
    const pago = parseFloat(valorPago) || 0
    if (pago > total) {
      setTroco(pago - total)
    } else {
      setTroco(0)
    }
  }, [valorPago, itens, bairroSelecionado])

  const loadDados = async () => {
    const tenantId = await activeTenantId()
    if (!tenantId) return

    const [{ data: clientesData }, { data: produtosData }, { data: bairrosData }, { data: complementosData }, { data: catsComp }] = await Promise.all([
      supabase.from('clientes').select('*').eq('tenant_id', tenantId).order('nome'),
      supabase.from('produtos').select('id, nome, preco, imagem_url').eq('tenant_id', tenantId).eq('ativo', true).order('nome'),
      supabase.from('enderecos_entrega').select('*').eq('tenant_id', tenantId).eq('ativo', true).order('bairro'),
      supabase.from('complementos').select('id, nome, preco, categoria_id').eq('tenant_id', tenantId).eq('ativo', true).order('nome'),
      supabase.from('categorias_complementos').select('id, nome, descricao_interna').eq('tenant_id', tenantId).eq('ativo', true).order('ordem')
    ])

    setClientes(clientesData || [])
    setProdutos(produtosData || [])
    setBairros(bairrosData || [])
    setComplementos(complementosData || [])
    setCategoriasComplementos(catsComp || [])
  }

  const cadastrarCliente = async () => {
    if (!novoCliente.nome.trim() || !novoCliente.telefone.trim()) {
      alert('Nome e telefone são obrigatórios')
      return
    }

    const tenantId = await activeTenantId()
    if (!tenantId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          tenant_id: tenantId,
          nome: novoCliente.nome,
          telefone: novoCliente.telefone.replace(/\D/g, ''),
          cpf: novoCliente.cpf || null,
          data_nascimento: novoCliente.data_nascimento || null,
          endereco: novoCliente.endereco || null,
          bairro: novoCliente.bairro || null,
          numero: novoCliente.numero || null,
          complemento: novoCliente.complemento || null,
        })
        .select()
        .single()

      if (error) throw error

      setClientes([...clientes, data])
      setClienteSelecionado(data)
      setMostrarFormCliente(false)
      setNovoCliente({ nome: '', telefone: '', cpf: '', data_nascimento: '', endereco: '', bairro: '', numero: '', complemento: '' })
    } catch (error: any) {
      alert('Erro ao cadastrar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const adicionarItem = (produto: Produto) => {
    setItens([...itens, {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade: 1,
      valor_unitario: produto.preco,
      complementos: [],
      observacao: ''
    }])
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

  const abrirComplementos = (item: ItemPedido) => {
    setItemSelecionandoComps(item.produto_id)
    // Carrega complementos já selecionados do item
    setComplementosSelecionados(item.complementos ?? [])
  }

  const toggleComplemento = (comp: Complemento) => {
    const jaTem = complementosSelecionados.find(c => c.id === comp.id)
    if (jaTem) {
      setComplementosSelecionados(complementosSelecionados.filter(c => c.id !== comp.id))
    } else {
      setComplementosSelecionados([...complementosSelecionados, comp])
    }
  }

  const salvarComplementos = () => {
    if (!itemSelecionandoComps) return
    setItens(itens.map(i =>
      i.produto_id === itemSelecionandoComps
        ? { ...i, complementos: complementosSelecionados }
        : i
    ))
    setItemSelecionandoComps(null)
    setComplementosSelecionados([])
  }

  const calcularTotalComplementos = (comps: Complemento[], qtd: number) => {
    return comps.reduce((acc, c) => acc + Number(c.preco), 0) * qtd
  }

  const calcularTotal = () => {
    const subtotal = itens.reduce((acc, item) => {
      const valorComps = calcularTotalComplementos(item.complementos || [], item.quantidade)
      return acc + (item.valor_unitario * item.quantidade) + valorComps
    }, 0)
    const taxa = tipoEntrega === 'delivery' && bairroSelecionado ? Number(bairroSelecionado.taxa) : 0
    // ajuste: positivo = desconto, negativo = acréscimo
    return subtotal + taxa - ajusteValor
  }

  const criarPedido = async () => {
    if (itens.length === 0) {
      alert('Adicione pelo menos um item ao pedido')
      return
    }

    if (tipoEntrega === 'delivery' && !bairroSelecionado) {
      alert('Selecione o bairro de entrega')
      return
    }

    setLoading(true)

    try {
      const tenantId = await activeTenantId()
      if (!tenantId) throw new Error('Não autenticado')

      // Se não tem cliente selecionado, cadastra rápido
      let clienteId = clienteSelecionado?.id
      if (!clienteId && novoCliente.nome && novoCliente.telefone) {
        const { data: novo, error: erroNovo } = await supabase
          .from('clientes')
          .insert({
            tenant_id: tenantId,
            nome: novoCliente.nome,
            telefone: novoCliente.telefone.replace(/\D/g, ''),
            cpf: novoCliente.cpf || null,
            data_nascimento: novoCliente.data_nascimento || null,
            endereco: endereco || null,
            bairro: bairroSelecionado?.bairro || null,
            numero: numero || null,
            complemento: complemento || null,
          })
          .select()
          .single()
        if (erroNovo) throw erroNovo
        clienteId = novo.id
      }

      if (!clienteId) {
        alert('Selecione ou cadastre um cliente')
        setLoading(false)
        return
      }

      const total = calcularTotal()
      const pago = parseFloat(valorPago) || total
      const taxaEntrega = tipoEntrega === 'delivery' && bairroSelecionado ? Number(bairroSelecionado.taxa) : 0

      const cliente = clienteSelecionado || { nome: novoCliente.nome, telefone: novoCliente.telefone }

      // Criar pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          tenant_id: tenantId,
          cliente_id: clienteId,
          cliente_nome: cliente.nome,
          cliente_whatsapp: cliente.telefone.replace(/\D/g, ''),
          status: 'novo',
          valor_total: total,
          valor_subtotal: total - taxaEntrega,
          taxa_entrega: taxaEntrega,
          forma_pagamento: [formaPagamento],
          valor_pago: [pago],
          troco: troco,
          observacoes: observacoes,
          tipo_entrega: tipoEntrega,
          bairro_entrega: bairroSelecionado?.bairro || null,
          taxa_bairro: taxaEntrega,
          endereco_entrega: endereco,
          numero_entrega: numero,
          complemento_entrega: complemento,
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
        complementos: item.complementos || [],
        observacao: item.observacao || null,
      }))

      await supabase.from('pedido_itens').insert(itensParaInserir)

      // Gerar mensagem WhatsApp
      const whatsappRes = await fetch('/api/whatsapp-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedido.id,
          tempo_preparo: 30,
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
    setNovoCliente({ nome: '', telefone: '', cpf: '', data_nascimento: '', endereco: '', bairro: '', numero: '', complemento: '' })
    setBairroSelecionado(null)
    setEndereco('')
    setNumero('')
    setComplemento('')
    setFormaPagamento('dinheiro')
    setValorPago('')
    setTroco(0)
    setObservacoes('')
    setAjusteValor(0)
    setMotivoAjuste('')
  }

  const total = calcularTotal()
  const totalComplementos = itens.reduce((acc, item) => acc + calcularTotalComplementos(item.complementos ?? [], item.quantidade), 0)

  const complementosAgrupados = categoriaFiltroComp
    ? complementos.filter(c => c.categoria_id === categoriaFiltroComp)
    : complementos

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="eyebrow mb-2">Novo Pedido</div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
          Lançar Pedido
        </h1>
        <p className="hint">Registre um pedido com o mesmo fluxo do cliente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ====== COLUNA 1: Cliente + Entrega + Pagamento ====== */}
        <div className="space-y-5">

          {/* Tipo de Entrega */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-4">Tipo de Entrega</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTipoEntrega('delivery')}
                className={`p-3 rounded-xl border-2 text-center transition ${tipoEntrega === 'delivery' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}
              >
                <Home className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">Delivery</span>
              </button>
              <button
                onClick={() => setTipoEntrega('retirada')}
                className={`p-3 rounded-xl border-2 text-center transition ${tipoEntrega === 'retirada' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}
              >
                <Store className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">Retirada</span>
              </button>
              <button
                onClick={() => setTipoEntrega('mesa')}
                className={`p-3 rounded-xl border-2 text-center transition ${tipoEntrega === 'mesa' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}
              >
                <Table2 className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">Mesa</span>
              </button>
            </div>
          </div>

          {/* Cliente */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Cliente
              </h3>
              <button
                onClick={() => setMostrarFormCliente(!mostrarFormCliente)}
                className="text-xs text-green-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {mostrarFormCliente ? 'Fechar' : 'Novo cliente'}
              </button>
            </div>

            {mostrarFormCliente ? (
              <div className="space-y-3">
                <input placeholder="Nome *" value={novoCliente.nome} onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} className="w-full" />
                <input placeholder="Telefone *" value={novoCliente.telefone} onChange={e => setNovoCliente({...novoCliente, telefone: e.target.value})} className="w-full" />
                <input placeholder="CPF" value={novoCliente.cpf} onChange={e => setNovoCliente({...novoCliente, cpf: e.target.value})} className="w-full" />
                <input type="date" placeholder="Nascimento" value={novoCliente.data_nascimento} onChange={e => setNovoCliente({...novoCliente, data_nascimento: e.target.value})} className="w-full" />
                <button onClick={cadastrarCliente} disabled={loading} className="btn-primary w-full justify-center text-sm">
                  <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            ) : (
              <>
                <select
                  value={clienteSelecionado?.id || ''}
                  onChange={(e) => {
                    const cliente = clientes.find(c => c.id === e.target.value)
                    setClienteSelecionado(cliente || null)
                    if (cliente) {
                      setNovoCliente({
                        nome: cliente.nome,
                        telefone: cliente.telefone,
                        cpf: cliente.cpf || '',
                        data_nascimento: cliente.data_nascimento || '',
                        endereco: cliente.endereco || '',
                        bairro: cliente.bairro || '',
                        numero: cliente.numero || '',
                        complemento: cliente.complemento || ''
                      })
                    }
                  }}
                  className="w-full mb-3"
                >
                  <option value="">Selecione um cliente...</option>
                  {clientes.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.telefone}
                    </option>
                  ))}
                </select>

                {clienteSelecionado && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm">
                    <p className="font-medium">{clienteSelecionado.nome}</p>
                    <p className="text-gray-600">{clienteSelecionado.telefone}</p>
                    {clienteSelecionado.endereco && (
                      <p className="text-gray-500">{clienteSelecionado.endereco}, {clienteSelecionado.numero}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Endereço (se delivery) */}
          {tipoEntrega === 'delivery' && (
            <div className="glass p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Endereço de Entrega
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Bairro *</label>
                  <select
                    value={bairroSelecionado?.id || ''}
                    onChange={(e) => {
                      const b = bairros.find(b => b.id === e.target.value)
                      setBairroSelecionado(b || null)
                    }}
                    className="w-full"
                  >
                    <option value="">Selecione o bairro...</option>
                    {bairros.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bairro} - {formatCurrency(b.taxa)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Endereço</label>
                  <input
                    placeholder="Rua,avenida..."
                    value={endereco}
                    onChange={e => setEndereco(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Número</label>
                    <input
                      placeholder="123"
                      value={numero}
                      onChange={e => setNumero(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Complemento</label>
                    <input
                      placeholder="Apto, casa..."
                      value={complemento}
                      onChange={e => setComplemento(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {bairroSelecionado && (
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-sm">Taxa de entrega: <strong>{formatCurrency(bairroSelecionado.taxa)}</strong></p>
                    {bairroSelecionado.prazo_min && (
                      <p className="text-xs text-gray-500">Prazo: ~{bairroSelecionado.prazo_min} min</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pagamento */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Pagamento
            </h3>

            <select
              value={formaPagamento}
              onChange={e => setFormaPagamento(e.target.value)}
              className="w-full mb-3"
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
            </select>

            {formaPagamento === 'dinheiro' && (
              <>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor pago pelo cliente"
                  value={valorPago}
                  onChange={e => setValorPago(e.target.value)}
                  className="w-full"
                />
                {troco > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                    <p className="text-sm text-amber-800">Troco para: <strong>{formatCurrency(parseFloat(valorPago))}</strong></p>
                    <p className="font-semibold text-amber-900">Voltar: {formatCurrency(troco)}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Observações */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-3">Observações</h3>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: Sem cebola, ponto da carne..."
              rows={2}
              className="w-full"
            />
          </div>
        </div>

        {/* ====== COLUNA 2: Produtos ====== */}
        <div className="lg:col-span-2">
          <div className="glass p-5">
            <h3 className="font-semibold mb-4">Produtos</h3>

            {produtos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum produto cadastrado</p>
                <p className="text-sm">Cadastre produtos no Cardápio primeiro</p>
              </div>
            ) : (
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
            )}

            {/* Itens do Pedido */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3">Itens do Pedido ({itens.length})</h4>

              {itens.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Adicione produtos ao pedido</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itens.map(item => (
                    <div key={item.produto_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(item.valor_unitario)} cada
                          {(item.complementos?.length ?? 0) > 0 && (
                            <span className="text-green-600 ml-1">
                              + {formatCurrency(calcularTotalComplementos(item.complementos ?? [], 1))} em complementos
                            </span>
                          )}
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
                        {formatCurrency(item.valor_unitario * item.quantidade + calcularTotalComplementos(item.complementos ?? [], item.quantidade))}
                      </p>

                      <button
                        onClick={() => abrirComplementos(item)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                      >
                        + Comp.
                      </button>

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

            {/* Ajuste de valor */}
            {itens.length > 0 && (
              <div className="border-t mt-6 pt-4">
                <h4 className="font-semibold mb-3">Ajuste de Valor</h4>
                <div className="flex items-center gap-3">
                  <select
                    value={ajusteValor >= 0 ? 'desconto' : 'acrescimo'}
                    onChange={e => setAjusteValor(e.target.value === 'desconto' ? Math.abs(ajusteValor) || 0 : -(Math.abs(ajusteValor) || 0))}
                    className="form-input w-32"
                  >
                    <option value="desconto">Desconto</option>
                    <option value="acrescimo">Acréscimo</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={Math.abs(ajusteValor) || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0
                      setAjusteValor(ajusteValor < 0 ? -val : val)
                    }}
                    placeholder="0,00"
                    className="form-input w-28"
                  />
                  <input
                    type="text"
                    value={motivoAjuste}
                    onChange={e => setMotivoAjuste(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className="form-input flex-1"
                  />
                  {ajusteValor !== 0 && (
                    <button
                      onClick={() => { setAjusteValor(0); setMotivoAjuste('') }}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                      title="Limpar ajuste"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {ajusteValor !== 0 && (
                  <p className={`text-sm mt-2 ${ajusteValor > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ajusteValor > 0
                      ? `Desconto de ${formatCurrency(ajusteValor)} aplicado`
                      : `Acréscimo de ${formatCurrency(Math.abs(ajusteValor))} aplicado`}
                    {motivoAjuste && <span className="text-gray-500"> — {motivoAjuste}</span>}
                  </p>
                )}
              </div>
            )}

            {/* Totais */}
            {itens.length > 0 && (
              <div className="border-t mt-6 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total - (tipoEntrega === 'delivery' && bairroSelecionado ? Number(bairroSelecionado.taxa) : 0))}</span>
                </div>
                {totalComplementos > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Complementos</span>
                    <span>+ {formatCurrency(totalComplementos)}</span>
                  </div>
                )}
                {tipoEntrega === 'delivery' && bairroSelecionado && (
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega ({bairroSelecionado.bairro})</span>
                    <span>{formatCurrency(Number(bairroSelecionado.taxa))}</span>
                  </div>
                )}
                {ajusteValor > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto</span>
                    <span>- {formatCurrency(ajusteValor)}</span>
                  </div>
                )}
                {ajusteValor < 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Acréscimo</span>
                    <span>+ {formatCurrency(Math.abs(ajusteValor))}</span>
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
            disabled={loading || itens.length === 0 || (tipoEntrega === 'delivery' && !bairroSelecionado)}
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

      {/* Modal de Complementos */}
      {itemSelecionandoComps && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Selecionar Complementos</h3>
              <button onClick={() => setItemSelecionandoComps(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Filtro por categoria */}
              <div className="mb-4">
                <select
                  value={categoriaFiltroComp}
                  onChange={e => setCategoriaFiltroComp(e.target.value)}
                  className="w-full"
                >
                  <option value="">Todas as categorias</option>
                  {categoriasComplementos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Lista de complementos */}
              <div className="space-y-2">
                {complementosAgrupados.map(comp => {
                  const cat = categoriasComplementos.find(c => c.id === comp.categoria_id)
                  const selecionado = complementosSelecionados.find(c => c.id === comp.id)
                  return (
                    <button
                      key={comp.id}
                      onClick={() => toggleComplemento(comp)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${
                        selecionado
                          ? 'bg-green-50 border-2 border-green-500'
                          : 'bg-white border border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <div className={`size-6 rounded-md flex items-center justify-center ${selecionado ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                        {selecionado && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{comp.nome}</p>
                        {cat && (
                          <p className="text-xs text-gray-500">{cat.nome}</p>
                        )}
                      </div>
                      <p className="font-semibold text-green-600">{formatCurrency(Number(comp.preco))}</p>
                    </button>
                  )
                })}
              </div>

              {complementosSelecionados.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">Selecionados:</p>
                  <p className="text-sm text-gray-600">
                    {complementosSelecionados.map(c => c.nome).join(', ')}
                  </p>
                  <p className="text-sm font-semibold text-green-600 mt-1">
                    Total: {formatCurrency(complementosSelecionados.reduce((acc, c) => acc + Number(c.preco), 0))}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <button onClick={salvarComplementos} className="btn-primary w-full justify-center">
                <Check className="w-4 h-4" /> Salvar Complementos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de Sucesso */}
      {pedidoCriado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-3xl p-8 w-full max-w-lg text-center">
            <div className="size-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}>
              <Check size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
              Pedido #{pedidoCriado.id.split('-')[0].toUpperCase()} criado!
            </h2>
            <p className="hint mb-6">{clienteSelecionado?.nome || novoCliente.nome} • {formatCurrency(pedidoCriado.valor_total)}</p>

            {whatsappMsg && (
              <div className="glass-soft p-4 rounded-2xl text-left mb-6" style={{ background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.25)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: '#25D162' }}>📱 Mensagem WhatsApp</div>
                <pre className="text-xs whitespace-pre-wrap break-all font-mono" style={{ color: 'var(--ink-muted)', maxHeight: 200, overflowY: 'auto' }}>
                  {whatsappMsg}
                </pre>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={copiarMsg} className="flex-1 btn-ghost justify-center">
                📋 Copiar mensagem
              </button>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium text-white transition" style={{ background: '#25D162', boxShadow: '0 4px 14px rgba(37,211,102,.4)' }}>
                  <MessageCircle size={18} />
                  Abrir WhatsApp
                </a>
              )}
            </div>

            <button onClick={novoPedido} className="mt-4 text-sm hint hover:underline">
              ← Lançar outro pedido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
