'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import {
  ArrowLeft, ShoppingBag, MapPin, CreditCard, Plus, Trash2, Check, MessageCircle,
  User, Phone, Home, Store, Table2, Save, X, Search, ChevronLeft, ChevronRight,
  Minus, Edit3, Clock, ImageIcon
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ============================================================
// TIPOS
// ============================================================
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
  descricao?: string
  tempo_preparo_min?: number
  variantes?: Variante[]
  listas?: ListaComplemento[]
}

interface Variante {
  id: string
  nome: string
  preco_adicional: number
}

interface ListaComplemento {
  id: string
  nome: string
  qtd_minima?: number
  qtd_maxima?: number
  obrigatorio?: boolean
  max_selecoes?: number
  max_um_de_cada?: boolean
  complementos: Complemento[]
}

interface Complemento {
  id: string
  nome: string
  preco: number
  imagem_url?: string
}

interface ItemPedido {
  id: string
  produto_id: string
  nome: string
  quantidade: number
  valor_unitario: number
  variante_id?: string
  variante_nome?: string
  variante_preco?: number
  complementos: ItemComplemento[]
  observacao?: string
  imagem_url?: string
}

interface ItemComplemento {
  id: string
  nome: string
  quantidade: number
  valor: number
}

interface Bairro {
  id: string
  bairro: string
  taxa: number
  prazo_min?: number
}

interface CategoriaComplemento {
  id: string
  nome: string
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatPhone(v: string) {
  const c = (v || '').replace(/\D/g, '').slice(0, 11)
  return c.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

function formatCpf(v: string) {
  const c = (v || '').replace(/\D/g, '').slice(0, 11)
  return c.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function normalizeCpf(v: string) {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

function gerarId() {
  return Math.random().toString(36).slice(2, 10)
}

// ============================================================
// COMPONENTE: Seletor de Bairro com Pesquisa
// ============================================================
function BairroSelector({
  bairros,
  selecionado,
  onSelect,
  label = 'Bairro'
}: {
  bairros: Bairro[]
  selecionado: Bairro | null
  onSelect: (b: Bairro | null) => void
  label?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtrados = useMemo(() => {
    if (!busca) return bairros
    const termo = busca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return bairros.filter(b =>
      b.bairro.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(termo)
    )
  }, [bairros, busca])

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label} *</label>
      <button
        type="button"
        onClick={() => { setAberto(!aberto); if (!aberto) setBusca('') }}
        className="w-full py-3 px-4 border border-gray-200 rounded-xl text-left bg-white hover:border-green-400 transition-colors flex items-center justify-between"
      >
        <span className={selecionado ? 'text-gray-900' : 'text-gray-400'}>
          {selecionado ? `${selecionado.bairro}` : 'Selecione o bairro...'}
        </span>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${aberto ? 'rotate-90' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Barra de pesquisa */}
          <div className="relative border-b">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar bairro..."
              className="w-full py-3 pl-10 pr-4 outline-none text-sm bg-white"
              autoFocus
            />
            {busca && (
              <button
                onClick={(e) => { e.stopPropagation(); setBusca('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Lista de bairros */}
          <div className="max-h-64 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Nenhum bairro encontrado
              </div>
            ) : (
              filtrados.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onSelect(b)
                    setAberto(false)
                    setBusca('')
                  }}
                  className={`w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center transition-colors ${
                    selecionado?.id === b.id ? 'bg-green-50' : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">{b.bairro}</span>
                  <span className="text-green-600 font-semibold text-sm">{formatCurrency(b.taxa)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// COMPONENTE: Modal de Produto com Complementos por Etapas
// ============================================================
function ProdutoModal({
  isOpen,
  onClose,
  produto,
  listas,
  onAdd,
  initialItem,
  onReplace,
}: {
  isOpen: boolean
  onClose: () => void
  produto: Produto | null
  listas: ListaComplemento[]
  onAdd: (item: Omit<ItemPedido, 'id'>) => void
  initialItem?: ItemPedido | null
  onReplace?: (itemId: string, item: Omit<ItemPedido, 'id'>) => void
}) {
  const [quantidade, setQuantidade] = useState(1)
  const [complementosSelecionados, setComplementosSelecionados] = useState<Record<string, number>>({})
  const [observacao, setObservacao] = useState('')
  const [etapa, setEtapa] = useState(0)

  useEffect(() => {
    if (isOpen && produto) {
      setQuantidade(initialItem?.quantidade || 1)
      setObservacao(initialItem?.observacao || '')
      setEtapa(0)
      // Restaurar complementos já selecionados
      const comps: Record<string, number> = {}
      ;(initialItem?.complementos || []).forEach(c => {
        comps[c.id] = c.quantidade
      })
      setComplementosSelecionados(comps)
    }
  }, [isOpen, produto, initialItem])

  if (!isOpen || !produto) return null

  const listaAtual = listas[etapa]
  const totalListas = listas.length
  const qtdNaLista = listaAtual?.complementos?.reduce((s, c) => s + (complementosSelecionados[c.id] || 0), 0) || 0
  const minimoLista = Number(listaAtual?.qtd_minima ?? (listaAtual?.obrigatorio ? 1 : 0))
  const maximoLista = Number(listaAtual?.qtd_maxima ?? listaAtual?.max_selecoes ?? 99)

  const precoComplementos = Object.entries(complementosSelecionados).reduce((acc, [id, qtd]) => {
    const comp = listaAtual?.complementos.find(c => c.id === id)
    const allComps = listas.flatMap(l => l.complementos)
    const c = allComps.find(x => x.id === id) || comp
    return acc + (c?.preco || 0) * qtd
  }, 0)
  const total = (produto.preco + precoComplementos) * quantidade

  function toggleComplemento(comp: Complemento) {
    setComplementosSelecionados(prev => {
      const maxItem = listaAtual?.max_um_de_cada ? 1 : 99
      const atual = prev[comp.id] || 0
      if (atual > 0) {
        const novo = { ...prev }
        delete novo[comp.id]
        return novo
      } else if (qtdNaLista < maximoLista) {
        return { ...prev, [comp.id]: 1 }
      }
      return prev
    })
  }

  function alterarQuantidade(comp: Complemento, delta: number) {
    setComplementosSelecionados(prev => {
      const atual = prev[comp.id] || 0
      const maxItem = listaAtual?.max_um_de_cada ? 1 : 99
      const proximo = Math.max(0, Math.min(maxItem, atual + delta))
      if (qtdNaLista + delta > maximoLista && delta > 0) return prev
      const novo = { ...prev }
      if (proximo) novo[comp.id] = proximo
      else delete novo[comp.id]
      return novo
    })
  }

  function podeAvancar() {
    return qtdNaLista >= minimoLista
  }

  function avancar() {
    if (podeAvancar()) {
      if (etapa < totalListas - 1) {
        setEtapa(e => e + 1)
      } else {
        adicionarAoPedido()
      }
    }
  }

  function voltar() {
    if (etapa > 0) setEtapa(e => e - 1)
  }

  function adicionarAoPedido() {
    const comps: ItemComplemento[] = Object.entries(complementosSelecionados)
      .filter(([_, qtd]) => qtd > 0)
      .flatMap(([id, qtd]) => {
        const allComps = listas.flatMap(l => l.complementos)
        const c = allComps.find(x => x.id === id)
        if (!c) return []
        return [{
          id,
          nome: c.nome,
          quantidade: qtd,
          valor: c.preco
        }]
      })

    if (!produto) return

    const item: Omit<ItemPedido, 'id'> = {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade,
      valor_unitario: produto.preco,
      complementos: comps,
      observacao: observacao.trim() || undefined,
      imagem_url: produto.imagem_url
    }

    if (initialItem && onReplace) {
      onReplace(initialItem.id, item)
    } else {
      onAdd(item)
    }

    onClose()
  }

  const todasListasObrigatorias = listas.every(l => l.obrigatorio || (l.qtd_minima ?? 0) > 0)
  const ultimaEtapa = etapa === totalListas - 1

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-3xl z-50 shadow-2xl bg-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-4 border-b">
          {totalListas > 0 && (
            <button
              onClick={etapa === 0 ? onClose : voltar}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              {etapa === 0 ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          )}
          <div className="text-center">
            {produto.imagem_url ? (
              <img src={produto.imagem_url} alt={produto.nome} className="w-20 h-20 mx-auto rounded-2xl object-contain bg-gray-50" />
            ) : (
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-green-600" />
              </div>
            )}
            <h2 className="text-xl font-bold text-center mt-2">{produto.nome}</h2>
            {produto.descricao && (
              <p className="text-sm text-gray-500 mt-1">{produto.descricao}</p>
            )}
          </div>
        </div>

        {/* Progresso das etapas */}
        {totalListas > 0 && (
          <div className="px-4 py-2 border-b bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Etapa {etapa + 1} de {totalListas}</span>
              <span>{qtdNaLista}/{maximoLista}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${((etapa) / totalListas) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {totalListas > 0 && listaAtual ? (
            <>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{listaAtual.nome}</h3>
              <p className="text-xs text-gray-500 mb-4">
                {minimoLista > 0 && `Obrigatório - mínimo ${minimoLista}`}
                {!minimoLista && 'Opcional'}
                {maximoLista < 99 && ` • Máximo ${maximoLista}`}
              </p>

              <div className="space-y-2">
                {listaAtual.complementos.map((comp) => {
                  const qtd = complementosSelecionados[comp.id] || 0
                  return (
                    <div
                      key={comp.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        qtd > 0 ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {comp.imagem_url && (
                          <img src={comp.imagem_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <div>
                          <span className="font-medium block text-sm">{comp.nome}</span>
                          <span className="text-green-600 text-sm">
                            {comp.preco === 0 ? 'Grátis' : `+ ${formatCurrency(comp.preco)}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {qtd > 0 ? (
                          <>
                            <button
                              onClick={() => alterarQuantidade(comp, -1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-bold w-6 text-center">{qtd}</span>
                            <button
                              onClick={() => alterarQuantidade(comp, 1)}
                              disabled={qtdNaLista >= maximoLista}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => toggleComplemento(comp)}
                            disabled={qtdNaLista >= maximoLista}
                            className="px-4 py-2 rounded-full border-2 border-green-500 text-green-600 font-semibold text-sm hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Este produto não possui complementos</p>
            </div>
          )}

          {/* Observação */}
          <div className="mt-6">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Sem cebola, ponto da carne..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-4">
          {/* Quantidade */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="font-bold text-xl w-8 text-center">{quantidade}</span>
              <button
                onClick={() => setQuantidade(q => q + 1)}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="text-xl font-bold text-green-600">{formatCurrency(total)}</span>
          </div>

          {/* Botão adicionar */}
          {totalListas > 0 ? (
            <button
              onClick={avancar}
              disabled={!podeAvancar()}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {ultimaEtapa ? (
                <>
                  <Check className="w-5 h-5" />
                  Adicionar ao Pedido
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={adicionarAoPedido}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Adicionar ao Pedido
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ============================================================
// COMPONENTE: Modal Cadastro de Cliente
// ============================================================
function ClienteModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (cliente: { nome: string; telefone: string; cpf?: string }) => void
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (isOpen) {
      setNome('')
      setTelefone('')
      setCpf('')
      setErro('')
    }
  }, [isOpen])

  function handleTelefone(v: string) {
    const c = v.replace(/\D/g, '').slice(0, 11)
    const formatado = c.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
    setTelefone(formatado)
  }

  function handleCpf(v: string) {
    const c = v.replace(/\D/g, '').slice(0, 11)
    const formatado = c.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    setCpf(formatado)
  }

  function handleSalvar() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório')
      return
    }
    if (telefone.replace(/\D/g, '').length < 10) {
      setErro('Telefone inválido')
      return
    }
    onSave({ nome: nome.trim(), telefone: telefone.replace(/\D/g, ''), cpf: cpf.replace(/\D/g, '') || undefined })
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-3xl z-50 shadow-2xl bg-white overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Novo Cliente</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <div className="p-6 space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nome <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setErro('') }}
                placeholder="Nome completo"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Telefone <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={telefone}
                onChange={(e) => { handleTelefone(e.target.value); setErro('') }}
                placeholder="(00) 00000-0000"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
              />
            </div>
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              CPF <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => handleCpf(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{erro}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            className="flex-1 py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Cadastrar
          </button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================
export default function NovoPedidoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [pedidoCriado, setPedidoCriado] = useState<any>(null)
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [whatsappMsg, setWhatsappMsg] = useState('')

  // Tipo de entrega
  const [tipoEntrega, setTipoEntrega] = useState<'delivery' | 'retirada' | 'mesa'>('delivery')

  // Cliente selecionado
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [telefoneClienteRapido, setTelefoneClienteRapido] = useState('')
  const [nomeClienteRapido, setNomeClienteRapido] = useState('')

  // Endereço
  const [bairroSelecionado, setBairroSelecionado] = useState<Bairro | null>(null)
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState<string>('dinheiro')
  const [valorPago, setValorPago] = useState('')
  const [troco, setTroco] = useState(0)

  // Observações
  const [observacoes, setObservacoes] = useState('')
  const [ajusteValor, setAjusteValor] = useState<number>(0)
  const [motivoAjuste, setMotivoAjuste] = useState('')

  // Modals
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false)
  const [mostrarModalProduto, setMostrarModalProduto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [itemEditando, setItemEditando] = useState<ItemPedido | null>(null)

  // Carregar dados
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

    // Buscar dados em paralelo - usando a MESMA estrutura do cardápio público
    const [
      { data: clientesData },
      { data: produtosData },
      { data: bairrosData },
      { data: complementosData },
      { data: listasData },
      { data: produtoComplementosData },
    ] = await Promise.all([
      supabase.from('clientes').select('*').eq('tenant_id', tenantId).order('nome'),
      supabase.from('produtos').select('id, nome, preco, imagem_url, descricao, tempo_preparo_min').eq('tenant_id', tenantId).eq('ativo', true).order('nome'),
      supabase.from('enderecos_entrega').select('*').eq('tenant_id', tenantId).eq('ativo', true).order('bairro'),
      // Complementos com categoria_id
      supabase.from('complementos').select('id, nome, preco, imagem_url, categoria_id, ordem').eq('tenant_id', tenantId).eq('ativo', true).order('ordem'),
      // Categorias de complementos (mesma tabela usada pelo cardápio público)
      supabase.from('categorias_complementos').select('id, nome, qtd_minima, qtd_maxima, obrigatorio, max_selecoes, max_um_de_cada, ordem').eq('tenant_id', tenantId).eq('ativo', true).order('ordem'),
      // Relação produto-complemento
      supabase.from('produto_complementos').select('produto_id, complemento_id').in('produto_id', (produtosData || []).map((p: any) => p.id)),
    ])

    // Carregar variantes dos produtos
    const { data: variantesData } = await supabase
      .from('variantes')
      .select('*')
      .in('produto_id', (produtosData || []).map((p: any) => p.id))

    // Mapear variantes para cada produto
    const produtosComVariantes = (produtosData || []).map((p: any) => ({
      ...p,
      variantes: (variantesData || []).filter((v: any) => v.produto_id === p.id)
    }))

    // Mapear complementos por produto (igual ao cardápio público)
    const complementosPorProduto: Record<string, any[]> = {}
    ;(produtoComplementosData || []).forEach((pc: any) => {
      const complemento = (complementosData || []).find((c: any) => c.id === pc.complemento_id)
      if (complemento) {
        if (!complementosPorProduto[pc.produto_id]) {
          complementosPorProduto[pc.produto_id] = []
        }
        complementosPorProduto[pc.produto_id].push(complemento)
      }
    })

    // Agrupar complementos por produto e categoria (igual ao cardápio público)
    const listasPorProduto: Record<string, ListaComplemento[]> = {}
    Object.entries(complementosPorProduto).forEach(([produtoId, comps]) => {
      const idsCategorias = new Set((comps as any[]).map((c: any) => c.categoria_id).filter(Boolean))
      listasPorProduto[produtoId] = (listasData || [])
        .filter((l: any) => idsCategorias.has(l.id))
        .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
        .map((l: any) => ({
          id: l.id,
          nome: l.nome,
          qtd_minima: l.qtd_minima,
          qtd_maxima: l.qtd_maxima,
          obrigatorio: l.obrigatorio,
          max_selecoes: l.max_selecoes,
          max_um_de_cada: l.max_um_de_cada,
          complementos: (comps as any[])
            .filter((c: any) => c.categoria_id === l.id)
            .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
        }))

      // Complementos sem categoria vão para um grupo "Adicionais"
      const semCategoria = (comps as any[]).filter((c: any) => !c.categoria_id)
        .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
      if (semCategoria.length) {
        listasPorProduto[produtoId].push({
          id: 'avulsos',
          nome: 'Adicionais',
          qtd_minima: 0,
          qtd_maxima: 99,
          obrigatorio: false,
          complementos: semCategoria
        })
      }
    })

    const produtosFinais = produtosComVariantes.map((p: any) => ({
      ...p,
      listas: listasPorProduto[p.id] || []
    }))

    setClientes(clientesData || [])
    setProdutos(produtosFinais)
    setBairros(bairrosData || [])
  }

  const cadastrarCliente = (cliente: { nome: string; telefone: string; cpf?: string }) => {
    setClientes([...clientes, { ...cliente, id: gerarId() } as Cliente])
    setClienteSelecionado({ ...cliente, id: gerarId() } as Cliente)
  }

  const abrirSelecaoProduto = (produto: Produto) => {
    setProdutoSelecionado(produto)
    setItemEditando(null)
    setMostrarModalProduto(true)
  }

  const adicionarItem = (item: Omit<ItemPedido, 'id'>) => {
    const novoItem: ItemPedido = { ...item, id: gerarId() }
    setItens([...itens, novoItem])
  }

  const editarItem = (item: ItemPedido) => {
    const produto = produtos.find(p => p.id === item.produto_id)
    if (produto) {
      setProdutoSelecionado(produto)
      setItemEditando(item)
      setMostrarModalProduto(true)
    }
  }

  const substituirItem = (itemId: string, novoItem: Omit<ItemPedido, 'id'>) => {
    setItens(itens.map(i => i.id === itemId ? { ...novoItem, id: itemId } : i))
  }

  const atualizarQuantidade = (itemId: string, quantidade: number) => {
    if (quantidade <= 0) {
      setItens(itens.filter(i => i.id !== itemId))
    } else {
      setItens(itens.map(i => i.id === itemId ? { ...i, quantidade } : i))
    }
  }

  const removerItem = (itemId: string) => {
    setItens(itens.filter(i => i.id !== itemId))
  }

  const calcularTotalComplementos = (comps: ItemComplemento[], qtd: number) => {
    return comps.reduce((acc, c) => acc + c.valor * c.quantidade, 0) * qtd
  }

  const calcularTotal = () => {
    const subtotal = itens.reduce((acc, item) => {
      const valorComps = calcularTotalComplementos(item.complementos, item.quantidade)
      return acc + (item.valor_unitario * item.quantidade) + valorComps
    }, 0)
    const taxa = tipoEntrega === 'delivery' && bairroSelecionado ? Number(bairroSelecionado.taxa) : 0
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

      let clienteId = clienteSelecionado?.id
      const nomeCliente = clienteSelecionado?.nome || nomeClienteRapido
      const telefoneCliente = clienteSelecionado?.telefone || telefoneClienteRapido.replace(/\D/g, '')

      // Cadastrar cliente rápido se necessário
      if (!clienteId && nomeCliente && telefoneCliente) {
        const { data: novo, error: erroNovo } = await supabase
          .from('clientes')
          .insert({
            tenant_id: tenantId,
            nome: nomeCliente,
            telefone: telefoneCliente,
            cpf: null,
            data_nascimento: null,
            endereco: endereco || null,
            bairro: bairroSelecionado?.bairro || null,
            numero: numero || null,
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

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          tenant_id: tenantId,
          cliente_id: clienteId,
          cliente_nome: nomeCliente,
          cliente_whatsapp: telefoneCliente,
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
        complementos: item.complementos.map(c => ({ id: c.id, nome: c.nome, quantidade: c.quantidade, valor: c.valor })),
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
    setNomeClienteRapido('')
    setTelefoneClienteRapido('')
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
  const totalComplementos = itens.reduce((acc, item) => acc + calcularTotalComplementos(item.complementos, item.quantidade), 0)

  // Listas de complementos do produto selecionado
  const listasDoProduto = produtoSelecionado?.listas || []

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
                onClick={() => setMostrarModalCliente(true)}
                className="text-xs text-green-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Novo cliente
              </button>
            </div>

            {/* Cliente existente */}
            <select
              value={clienteSelecionado?.id || ''}
              onChange={(e) => {
                const cliente = clientes.find(c => c.id === e.target.value)
                setClienteSelecionado(cliente || null)
                if (cliente) {
                  setNomeClienteRapido('')
                  setTelefoneClienteRapido('')
                }
              }}
              className="w-full mb-3 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            >
              <option value="">Selecione um cliente...</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome} - {cliente.telefone}
                </option>
              ))}
            </select>

            {/* Ou cadastrar rápido */}
            {!clienteSelecionado && (
              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs text-gray-500 text-center">ou cadastre rapidamente</p>
                <input
                  type="text"
                  value={nomeClienteRapido}
                  onChange={(e) => setNomeClienteRapido(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                />
                <input
                  type="tel"
                  value={telefoneClienteRapido}
                  onChange={(e) => setTelefoneClienteRapido(formatPhone(e.target.value))}
                  placeholder="WhatsApp"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                />
              </div>
            )}

            {/* Info do cliente selecionado */}
            {clienteSelecionado && (
              <div className="p-3 bg-green-50 rounded-xl text-sm">
                <p className="font-semibold">{clienteSelecionado.nome}</p>
                <p className="text-gray-600">{clienteSelecionado.telefone}</p>
                {clienteSelecionado.endereco && (
                  <p className="text-gray-500 text-xs mt-1">{clienteSelecionado.endereco}, {clienteSelecionado.numero}</p>
                )}
              </div>
            )}
          </div>

          {/* Endereço (se delivery) */}
          {tipoEntrega === 'delivery' && (
            <div className="glass p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Endereço de Entrega
              </h3>

              <div className="space-y-4">
                {/* Bairro com pesquisa */}
                <BairroSelector
                  bairros={bairros}
                  selecionado={bairroSelecionado}
                  onSelect={setBairroSelecionado}
                  label="Bairro"
                />

                {/* Endereço */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Rua / Avenida</label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Nome da rua"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                </div>

                {/* Número e Complemento */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Número</label>
                    <input
                      type="text"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Complemento</label>
                    <input
                      type="text"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Apto, casa..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                    />
                  </div>
                </div>

                {/* Info da taxa */}
                {bairroSelecionado && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Taxa de entrega:</span>
                      <span className="font-bold text-amber-800">{formatCurrency(bairroSelecionado.taxa)}</span>
                    </div>
                    {bairroSelecionado.prazo_min && (
                      <p className="text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Prazo: ~{bairroSelecionado.prazo_min} min
                      </p>
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
              onChange={(e) => setFormaPagamento(e.target.value)}
              className="w-full mb-3 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
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
                  onChange={(e) => setValorPago(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                />
                {troco > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mt-3">
                    <p className="text-sm text-amber-800">
                      Troco para: <strong>{formatCurrency(parseFloat(valorPago))}</strong>
                    </p>
                    <p className="font-bold text-amber-900 text-lg mt-1">
                      Voltar: {formatCurrency(troco)}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Observações */}
          <div className="glass p-5">
            <h3 className="font-semibold mb-3">Observações do Pedido</h3>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Sem cebola, ponto da carne..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
          </div>
        </div>

        {/* ====== COLUNA 2: Produtos ====== */}
        <div className="lg:col-span-2">
          <div className="glass p-5">
            <h3 className="font-semibold mb-4">Produtos</h3>

            {produtos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Nenhum produto cadastrado</p>
                <p className="text-sm">Cadastre produtos no Cardápio primeiro</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {produtos.map(produto => (
                  <button
                    key={produto.id}
                    onClick={() => abrirSelecaoProduto(produto)}
                    className="p-3 border border-gray-200 rounded-xl text-left hover:border-green-500 hover:bg-green-50 transition-all"
                  >
                    {produto.imagem_url ? (
                      <img src={produto.imagem_url} alt={produto.nome} className="w-full h-24 object-cover rounded-lg mb-2" />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm line-clamp-2">{produto.nome}</span>
                    </div>
                    <p className="text-green-600 font-semibold text-sm mt-1">
                      {formatCurrency(produto.preco)}
                    </p>
                    {produto.listas && produto.listas.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        + {produto.listas.length} grupo{produto.listas.length > 1 ? 's' : ''} de complementos
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Itens do Pedido */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3">Itens do Pedido ({itens.length})</h4>

              {itens.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Adicione produtos ao pedido</p>
                  <p className="text-sm">Clique em um produto para personalizá-lo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itens.map(item => {
                    const valorComplementos = calcularTotalComplementos(item.complementos, item.quantidade)
                    const valorTotal = (item.valor_unitario * item.quantidade) + valorComplementos

                    return (
                      <div key={item.id} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex gap-3">
                          {/* Imagem */}
                          {item.imagem_url && (
                            <img src={item.imagem_url} alt={item.nome} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold">{item.nome}</p>
                                <p className="text-sm text-gray-500">
                                  {formatCurrency(item.valor_unitario)} cada
                                </p>
                              </div>
                              <p className="font-bold text-green-600 shrink-0">
                                {formatCurrency(valorTotal)}
                              </p>
                            </div>

                            {/* Complementos */}
                            {item.complementos.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {item.complementos.map(c => (
                                  <p key={c.id} className="text-xs text-gray-500">
                                    + {c.quantidade}x {c.nome}
                                    {c.valor > 0 && ` (${formatCurrency(c.valor * c.quantidade)})`}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Observação */}
                            {item.observacao && (
                              <p className="text-xs text-gray-400 mt-1 italic">
                                Obs: {item.observacao}
                              </p>
                            )}

                            {/* Ações */}
                            <div className="flex items-center gap-2 mt-3">
                              <button
                                onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-200"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-bold w-6 text-center">{item.quantidade}</span>
                              <button
                                onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-200"
                              >
                                <Plus className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => editarItem(item)}
                                className="ml-auto px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                Editar
                              </button>

                              <button
                                onClick={() => removerItem(item.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-green-500 outline-none"
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
                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm w-28 focus:border-green-500 outline-none"
                  />
                  <input
                    type="text"
                    value={motivoAjuste}
                    onChange={e => setMotivoAjuste(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm flex-1 focus:border-green-500 outline-none"
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

      {/* Modal de Cliente */}
      <ClienteModal
        isOpen={mostrarModalCliente}
        onClose={() => setMostrarModalCliente(false)}
        onSave={cadastrarCliente}
      />

      {/* Modal de Produto */}
      <ProdutoModal
        isOpen={mostrarModalProduto}
        onClose={() => { setMostrarModalProduto(false); setProdutoSelecionado(null); setItemEditando(null) }}
        produto={produtoSelecionado}
        listas={listasDoProduto}
        onAdd={adicionarItem}
        initialItem={itemEditando || undefined}
        onReplace={substituirItem}
      />

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
            <p className="hint mb-6">{clienteSelecionado?.nome || nomeClienteRapido} • {formatCurrency(pedidoCriado.valor_total)}</p>

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
