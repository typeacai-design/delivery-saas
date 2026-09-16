'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, MapPin, CreditCard, Plus, Trash2, Check, MessageCircle,
  User, Phone, Home, Store, Table2, Save, X, Search, ChevronLeft, ChevronRight,
  Minus, Edit3, Clock, ImageIcon, Loader2
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/toast'

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
  sabores_grupo_id?: string | null
  sabores_maximo?: number
  exibir_preco_a_partir_de?: boolean
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
  sabores_quantidade?: number
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
  tipo?: string
  grupo_id?: string
  fracao_denominador?: number
  preco_integral?: number
  regra_preco?: string
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

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatPhone(v: string) {
  const c = (v || '').replace(/\D/g, '').slice(0, 11)
  return c.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

function gerarId() {
  return Math.random().toString(36).slice(2, 10)
}

function chargedProductBase(produto: Produto) {
  return Number(produto.preco || 0)
}

// ============================================================
// COMPONENTE: Seletor de Bairro
// ============================================================
function BairroSelector({
  bairros,
  selecionado,
  onSelect,
}: {
  bairros: Bairro[]
  selecionado: Bairro | null
  onSelect: (b: Bairro | null) => void
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
      <button
        type="button"
        onClick={() => { setAberto(!aberto); if (!aberto) setBusca('') }}
        className="w-full py-3 px-4 border border-gray-200 rounded-xl text-left bg-white hover:border-green-400 transition-colors flex items-center justify-between"
      >
        <span className={selecionado ? 'text-gray-900' : 'text-gray-400'}>
          {selecionado ? `${selecionado.bairro} - ${formatCurrency(selecionado.taxa)}` : 'Selecione o bairro...'}
        </span>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${aberto ? 'rotate-90' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
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
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">Nenhum bairro encontrado</div>
            ) : (
              filtrados.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { onSelect(b); setAberto(false); setBusca('') }}
                  className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
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
// COMPONENTE: Modal de Produto
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
      const comps: Record<string, number> = {}
      ;(initialItem?.complementos || []).forEach(c => { comps[c.id] = c.quantidade })
      setComplementosSelecionados(comps)
    }
  }, [isOpen, produto, initialItem])

  if (!isOpen || !produto) return null

  const listaAtual = listas[etapa]
  const totalListas = listas.length
  const qtdNaLista = listaAtual?.complementos?.reduce((s, c) => s + (complementosSelecionados[c.id] || 0), 0) || 0
  const minimoLista = Number(listaAtual?.qtd_minima ?? 0)
  const maximoLista = Number(listaAtual?.qtd_maxima ?? 99)

  const precoComplementos = Object.entries(complementosSelecionados).reduce((acc, [id, qtd]) => {
    const allComps = listas.flatMap(l => l.complementos)
    const c = allComps.find(x => x.id === id)
    return acc + (c?.preco || 0) * qtd
  }, 0)
  const total = (chargedProductBase(produto) + precoComplementos) * quantidade

  function toggleComplemento(comp: Complemento) {
    setComplementosSelecionados(prev => {
      const atual = prev[comp.id] || 0
      if (atual > 0) {
        const novo = { ...prev }; delete novo[comp.id]; return novo
      } else if (qtdNaLista < maximoLista) {
        return { ...prev, [comp.id]: 1 }
      }
      return prev
    })
  }

  function podeAvancar() { return qtdNaLista >= minimoLista }

  function avancar() {
    if (podeAvancar()) {
      if (etapa < totalListas - 1) setEtapa(e => e + 1)
      else adicionarAoPedido()
    }
  }

  function adicionarAoPedido() {
    const allComps = listas.flatMap(l => l.complementos)
    const comps: ItemComplemento[] = Object.entries(complementosSelecionados)
      .filter(([_, qtd]) => qtd > 0)
      .flatMap(([id, qtd]) => {
        const c = allComps.find(x => x.id === id)
        if (!c) return []
        return [{ id, nome: c.nome, quantidade: qtd, valor: c.preco }]
      })

    if (!produto) return

    const item: Omit<ItemPedido, 'id'> = {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade,
      valor_unitario: chargedProductBase(produto),
      complementos: comps,
      observacao: observacao.trim() || undefined,
      imagem_url: produto.imagem_url
    }

    if (initialItem && onReplace) onReplace(initialItem.id, item)
    else onAdd(item)
    onClose()
  }

  const ultimaEtapa = etapa === totalListas - 1

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-3xl z-50 shadow-2xl bg-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-4 border-b">
          <button onClick={etapa === 0 ? onClose : () => setEtapa(e => e - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full">
            {etapa === 0 ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <div className="text-center">
            {produto.imagem_url ? (
              <img src={produto.imagem_url} alt={produto.nome} className="w-20 h-20 mx-auto rounded-2xl object-contain bg-gray-50" />
            ) : (
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-green-600" />
              </div>
            )}
            <h2 className="text-xl font-bold text-center mt-2">{produto.nome}</h2>
          </div>
        </div>

        {/* Progresso */}
        {totalListas > 0 && (
          <div className="px-4 py-2 border-b bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Etapa {etapa + 1} de {totalListas}</span>
              <span>{qtdNaLista}/{maximoLista}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${((etapa) / totalListas) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {totalListas > 0 && listaAtual ? (
            <>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{listaAtual.nome}</h3>
              <p className="text-xs text-gray-500 mb-4">
                {minimoLista > 0 ? `Obrigatório - mínimo ${minimoLista}` : 'Opcional'}
                {maximoLista < 99 && ` • Máximo ${maximoLista}`}
              </p>
              <div className="space-y-2">
                {listaAtual.complementos.map((comp) => {
                  const qtd = complementosSelecionados[comp.id] || 0
                  return (
                    <div key={comp.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${qtd > 0 ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="font-medium block text-sm">{comp.nome}</span>
                          <span className="text-green-600 text-sm">{comp.preco === 0 ? 'Grátis' : `+ ${formatCurrency(comp.preco)}`}</span>
                        </div>
                      </div>
                      {qtd > 0 ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleComplemento(comp)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                          <span className="font-bold w-6 text-center">{qtd}</span>
                          <button onClick={() => toggleComplemento(comp)} disabled={qtdNaLista >= maximoLista} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50"><Plus className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => toggleComplemento(comp)} disabled={qtdNaLista >= maximoLista} className="px-4 py-2 rounded-full border-2 border-green-500 text-green-600 font-semibold text-sm disabled:opacity-50">
                          Adicionar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500"><p>Este produto não possui complementos</p></div>
          )}

          <div className="mt-6">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: Sem cebola..." rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Quantidade</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center"><Minus className="w-5 h-5" /></button>
              <span className="font-bold text-xl w-8 text-center">{quantidade}</span>
              <button onClick={() => setQuantidade(q => q + 1)} className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="text-xl font-bold text-green-600">{formatCurrency(total)}</span>
          </div>
          {totalListas > 0 ? (
            <button onClick={avancar} disabled={!podeAvancar()} className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {ultimaEtapa ? <><Check className="w-5 h-5" /> Adicionar ao Pedido</> : <>Próximo <ChevronRight className="w-5 h-5" /></>}
            </button>
          ) : (
            <button onClick={adicionarAoPedido} className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2">
              <Check className="w-5 h-5" /> Adicionar ao Pedido
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
function ClienteModal({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (cliente: { nome: string; telefone: string }) => void }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => { if (isOpen) { setNome(''); setTelefone(''); setErro('') } }, [isOpen])

  function handleTelefone(v: string) {
    const c = v.replace(/\D/g, '').slice(0, 11)
    setTelefone(c.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim())
  }

  function handleSalvar() {
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    if (telefone.replace(/\D/g, '').length < 10) { setErro('Telefone inválido'); return }
    onSave({ nome: nome.trim(), telefone: telefone.replace(/\D/g, '') })
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-3xl z-50 shadow-2xl bg-white overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Novo Cliente</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome <span className="text-red-500">*</span></label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={nome} onChange={(e) => { setNome(e.target.value); setErro('') }} placeholder="Nome completo" className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone <span className="text-red-500">*</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="tel" value={telefone} onChange={(e) => { handleTelefone(e.target.value); setErro('') }} placeholder="(00) 00000-0000" className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{erro}</p>}
        </div>
        <div className="p-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold border border-gray-300">Cancelar</button>
          <button onClick={handleSalvar} className="flex-1 py-3 rounded-xl font-semibold bg-green-600 text-white flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Cadastrar</button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// PÁGINA PRINCIPAL - AMBIENTE OPERACIONAL DE ATENDIMENTO
// ============================================================
export default function NovoPedidoAtendimentoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { error: toastError, success: toastSuccess } = useToast()

  const [loading, setLoading] = useState(false)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [membro, setMembro] = useState<any>(null)
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantNome, setTenantNome] = useState<string>('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [pedidoCriado, setPedidoCriado] = useState<any>(null)
  const [whatsappMsg, setWhatsappMsg] = useState('')

  // Verificar autenticação
  useEffect(() => {
    const membroStr = localStorage.getItem('membro_equipe')
    if (!membroStr) {
      router.push('/acesso')
      return
    }
    const membroData = JSON.parse(membroStr)
    if (membroData.perfil !== 'attendant') {
      toastError('Acesso não permitido')
      router.push('/acesso')
      return
    }
    setMembro(membroData)
    setTenantId(membroData.tenant_id)
    loadDados(membroData.tenant_id)
    setLoadingAuth(false)
  }, [])

  const loadDados = async (tid: string) => {
    const { data: tenantData } = await supabase.from('tenants').select('nome').eq('id', tid).single()
    if (tenantData) setTenantNome(tenantData.nome || 'Nossa Loja')

    const [{ data: clientesData }, { data: produtosData }, { data: bairrosData }, { data: complementosData }, { data: listasData }] = await Promise.all([
      supabase.from('clientes').select('*').eq('tenant_id', tid).eq('ativo', true).order('nome'),
      supabase.from('produtos').select('id, nome, preco, imagem_url, descricao, sabores_grupo_id, sabores_maximo').eq('tenant_id', tid).eq('ativo', true).order('nome'),
      supabase.from('enderecos_entrega').select('*').eq('tenant_id', tid).eq('ativo', true).order('bairro'),
      supabase.from('complementos').select('id, nome, preco, imagem_url, categoria_id, ordem').eq('tenant_id', tid).eq('ativo', true).order('ordem'),
      supabase.from('categorias_complementos').select('id, nome, qtd_minima, qtd_maxima, max_um_de_cada, ordem').eq('tenant_id', tid).eq('ativo', true).order('ordem'),
    ])

    const idsProdutos = (produtosData || []).map((p: any) => p.id)
    const [{ data: produtoComplementosData }, { data: variantesData }] = await Promise.all([
      supabase.from('produto_complementos').select('produto_id, complemento_id').in('produto_id', idsProdutos),
      supabase.from('variantes').select('*').in('produto_id', idsProdutos),
    ])

    const produtosComVariantes = (produtosData || []).map((p: any) => ({ ...p, variantes: (variantesData || []).filter((v: any) => v.produto_id === p.id) }))

    const complementosPorProduto: Record<string, any[]> = {}
    ;(produtoComplementosData || []).forEach((pc: any) => {
      const comp = (complementosData || []).find((c: any) => c.id === pc.complemento_id)
      if (comp) {
        if (!complementosPorProduto[pc.produto_id]) complementosPorProduto[pc.produto_id] = []
        complementosPorProduto[pc.produto_id].push(comp)
      }
    })

    const listasPorProduto: Record<string, ListaComplemento[]> = {}
    Object.entries(complementosPorProduto).forEach(([produtoId, comps]) => {
      const idsCategorias = new Set((comps as any[]).map((c: any) => c.categoria_id).filter(Boolean))
      listasPorProduto[produtoId] = (listasData || []).filter((l: any) => idsCategorias.has(l.id)).map((l: any) => ({
        id: l.id, nome: l.nome, qtd_minima: l.qtd_minima, qtd_maxima: l.qtd_maxima, max_um_de_cada: l.max_um_de_cada,
        complementos: (comps as any[]).filter((c: any) => c.categoria_id === l.id)
      }))
      const semCategoria = (comps as any[]).filter((c: any) => !c.categoria_id)
      if (semCategoria.length) listasPorProduto[produtoId].push({ id: 'avulsos', nome: 'Adicionais', qtd_minima: 0, qtd_maxima: 99, max_um_de_cada: false, complementos: semCategoria })
    })

    const produtosFinais = produtosComVariantes.map((p: any) => ({ ...p, listas: listasPorProduto[p.id] || [] }))
    setProdutos(produtosFinais)
    setClientes(clientesData || [])
    setBairros(bairrosData || [])
  }

  // Tipo de entrega
  const [tipoEntrega, setTipoEntrega] = useState<'delivery' | 'retirada' | 'mesa'>('delivery')
  const [mesaNumero, setMesaNumero] = useState('')
  const [mesaClienteNome, setMesaClienteNome] = useState('')
  const [mesaClienteWhatsapp, setMesaClienteWhatsapp] = useState('')

  // Cliente
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false)

  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes
    const b = buscaCliente.toLowerCase()
    return clientes.filter(c => (c.nome || '').toLowerCase().includes(b) || (c.telefone || '').includes(b))
  }, [clientes, buscaCliente])

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

  // Modals
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false)
  const [mostrarModalProduto, setMostrarModalProduto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [itemEditando, setItemEditando] = useState<ItemPedido | null>(null)

  useEffect(() => {
    const total = calcularTotal()
    const pago = parseFloat(valorPago) || 0
    if (pago > total) setTroco(pago - total)
    else setTroco(0)
  }, [valorPago, itens, bairroSelecionado])

  const cadastrarCliente = async (cliente: { nome: string; telefone: string }) => {
    const { data: novo, error } = await supabase.from('clientes').insert({ tenant_id: tenantId, nome: cliente.nome, telefone: cliente.telefone }).select().single()
    if (error || !novo) { toastError('Erro ao cadastrar cliente'); return }
    setClientes(prev => [...prev, novo as Cliente])
    setClienteSelecionado(novo as Cliente)
  }

  const abrirSelecaoProduto = (produto: Produto) => { setProdutoSelecionado(produto); setItemEditando(null); setMostrarModalProduto(true) }
  const adicionarItem = (item: Omit<ItemPedido, 'id'>) => { setItens([...itens, { ...item, id: gerarId() }]) }
  const editarItem = (item: ItemPedido) => { const p = produtos.find(x => x.id === item.produto_id); if (p) { setProdutoSelecionado(p); setItemEditando(item); setMostrarModalProduto(true) } }
  const substituirItem = (itemId: string, novoItem: Omit<ItemPedido, 'id'>) => { setItens(itens.map(i => i.id === itemId ? { ...novoItem, id: itemId } : i)) }
  const atualizarQuantidade = (itemId: string, quantidade: number) => { if (quantidade <= 0) setItens(itens.filter(i => i.id !== itemId)); else setItens(itens.map(i => i.id === itemId ? { ...i, quantidade } : i)) }
  const removerItem = (itemId: string) => { setItens(itens.filter(i => i.id !== itemId)) }

  const calcularTotalComplementos = (comps: ItemComplemento[], qtd: number) => comps.reduce((acc, c) => acc + c.valor * c.quantidade, 0) * qtd
  const calcularTotal = () => {
    const subtotal = itens.reduce((acc, item) => acc + (item.valor_unitario * item.quantidade) + calcularTotalComplementos(item.complementos, item.quantidade), 0)
    const taxa = tipoEntrega === 'delivery' && bairroSelecionado ? Number(bairroSelecionado.taxa) : 0
    return subtotal + taxa
  }

  const criarPedido = async () => {
    if (itens.length === 0) { toastError('Adicione pelo menos um item'); return }
    if (tipoEntrega === 'delivery' && !bairroSelecionado) { toastError('Selecione o bairro'); return }

    setLoading(true)
    try {
      let clienteId = clienteSelecionado?.id
      const nomeCliente = clienteSelecionado?.nome || ''
      const telefoneCliente = clienteSelecionado?.telefone || ''

      if (tipoEntrega !== 'mesa' && !clienteId && nomeCliente && telefoneCliente) {
        const { data: novo, error: erroNovo } = await supabase.from('clientes').insert({ tenant_id: tenantId, nome: nomeCliente, telefone: telefoneCliente.replace(/\D/g, '') }).select().single()
        if (erroNovo) throw erroNovo
        clienteId = novo.id
      }

      if (tipoEntrega !== 'mesa' && !clienteId) { toastError('Selecione ou cadastre um cliente'); setLoading(false); return }

      let sessaoMesaId: string | null = null
      if (tipoEntrega === 'mesa') {
        if (!mesaNumero.trim()) { toastError('Informe o número da mesa'); setLoading(false); return }
        const sessaoRes = await fetch('/api/sessoes-mesa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mesa_numero: mesaNumero.trim(), cliente_nome: mesaClienteNome.trim() || `Mesa ${mesaNumero}`, cliente_whatsapp: mesaClienteWhatsapp.trim() || null }) })
        const sessaoData = await sessaoRes.json()
        if (!sessaoRes.ok) throw new Error(`[sessoes-mesa] ${sessaoData.error}`)
        sessaoMesaId = sessaoData.sessao?.id || null
      }

      const total = calcularTotal()
      const taxaEntrega = tipoEntrega === 'delivery' && bairroSelecionado ? Number(bairroSelecionado.taxa) : 0
      const itensParaApi = itens.map(item => ({ produto_id: item.produto_id, nome: item.nome, quantidade: item.quantidade, valor_unitario: item.valor_unitario, valor_total: item.valor_unitario * item.quantidade + (item.complementos?.reduce((s, c) => s + c.valor * c.quantidade, 0) || 0) * item.quantidade, complementos: item.complementos, observacao: item.observacao || null }))

      const res = await fetch('/api/pedidos/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        cliente_id: tipoEntrega === 'mesa' ? null : clienteId,
        cliente_nome: tipoEntrega === 'mesa' ? mesaClienteNome.trim() || `Mesa ${mesaNumero}` : nomeCliente,
        cliente_whatsapp: tipoEntrega === 'mesa' ? mesaClienteWhatsapp.trim() || null : telefoneCliente,
        itens: itensParaApi,
        valor_subtotal: total - taxaEntrega,
        taxa_entrega: taxaEntrega,
        valor_desconto: 0,
        valor_acrescimo: 0,
        valor_total: total,
        forma_pagamento: tipoEntrega === 'mesa' ? null : formaPagamento,
        troco_para: tipoEntrega === 'mesa' ? null : troco,
        bairro_entrega: bairroSelecionado?.bairro || null,
        taxa_bairro: taxaEntrega,
        observacoes: observacoes,
        tipo_entrega: tipoEntrega,
        tipo_pedido: tipoEntrega === 'mesa' ? 'mesa' : tipoEntrega === 'retirada' ? 'retirada' : 'delivery',
        sessao_mesa_id: sessaoMesaId,
        endereco, numero, complemento,
      }) })

      const data = await res.json()
      if (!res.ok) throw new Error(`[pedidos/manual] ${data.error || res.status}`)

      setPedidoCriado(data)
      toastSuccess('Pedido criado!', `Total: ${formatCurrency(data.valor_total)}`)

      const whatsappRes = await fetch('/api/whatsapp-pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido_id: data.id, tempo_preparo: 30, forma_pagamento: [formaPagamento] }) })
      const whatsappData = await whatsappRes.json()
      setWhatsappMsg(whatsappData.mensagem || '')

    } catch (error: any) {
      console.error(error)
      toastError('Erro ao criar pedido', error.message)
    } finally {
      setLoading(false)
    }
  }

  const copiarMsg = () => navigator.clipboard.writeText(whatsappMsg)
  const novoPedido = () => { setPedidoCriado(null); setWhatsappMsg(''); setItens([]); setClienteSelecionado(null); setBuscaCliente(''); setBairroSelecionado(null); setEndereco(''); setNumero(''); setComplemento(''); setFormaPagamento('dinheiro'); setValorPago(''); setTroco(0); setObservacoes(''); setTipoEntrega('delivery'); setMesaNumero(''); setMesaClienteNome(''); setMesaClienteWhatsapp('') }

  const total = calcularTotal()
  const totalComplementos = itens.reduce((acc, item) => acc + calcularTotalComplementos(item.complementos, item.quantidade), 0)
  const listasDoProduto = produtoSelecionado?.listas || []

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-green-600" size={40} /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-600 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/acesso/atendimento')} className="p-2 bg-white/20 rounded-lg hover:bg-white/30">
              <ArrowLeft size={20} />
            </button>
            <div className="text-center">
              <h1 className="font-bold text-lg leading-tight">NOVO PEDIDO</h1>
              <p className="text-green-200 text-xs">{tenantNome}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Cliente + Entrega + Pagamento */}
          <div className="space-y-5">
            {/* Tipo de Entrega */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4">Tipo de Entrega</h3>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setTipoEntrega('delivery')} className={`p-3 rounded-xl border-2 text-center transition ${tipoEntrega === 'delivery' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <Home className="w-5 h-5 mx-auto mb-1" /><span className="text-xs font-medium">Delivery</span>
                </button>
                <button onClick={() => setTipoEntrega('retirada')} className={`p-3 rounded-xl border-2 text-center transition ${tipoEntrega === 'retirada' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <Store className="w-5 h-5 mx-auto mb-1" /><span className="text-xs font-medium">Retirada</span>
                </button>
                <button onClick={() => setTipoEntrega('mesa')} className={`p-3 rounded-xl border-2 text-center transition ${tipoEntrega === 'mesa' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <Table2 className="w-5 h-5 mx-auto mb-1" /><span className="text-xs font-medium">Mesa</span>
                </button>
              </div>

              {tipoEntrega === 'mesa' && (
                <div className="mt-3 p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">🍽️ <span>Pedido de mesa</span></div>
                  <input type="text" placeholder="Nº da mesa" value={mesaNumero} onChange={(e) => setMesaNumero(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="text" placeholder="Nome do cliente" value={mesaClienteNome} onChange={(e) => setMesaClienteNome(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="text" placeholder="WhatsApp (opcional)" value={mesaClienteWhatsapp} onChange={(e) => setMesaClienteWhatsapp(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              )}
            </div>

            {/* Cliente (não para mesa) */}
            {tipoEntrega !== 'mesa' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2"><User className="w-5 h-5 text-green-600" /> Cliente</h3>
                  <button onClick={() => setMostrarModalCliente(true)} className="text-xs text-green-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Novo</button>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Buscar cliente..." value={buscaCliente} onChange={(e) => { setBuscaCliente(e.target.value); setMostrarListaClientes(true) }} onFocus={() => setMostrarListaClientes(true)} className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm" />
                  {buscaCliente && <button onClick={() => { setBuscaCliente(''); setClienteSelecionado(null) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
                </div>
                {clienteSelecionado && (
                  <div className="p-3 bg-green-50 rounded-xl text-sm border border-green-200">
                    <div className="flex items-start justify-between">
                      <div><p className="font-semibold text-green-900">{clienteSelecionado.nome}</p><p className="text-gray-600">{clienteSelecionado.telefone}</p></div>
                      <button onClick={() => setClienteSelecionado(null)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
                {!clienteSelecionado && mostrarListaClientes && clientesFiltrados.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg max-h-60 overflow-y-auto">
                    {clientesFiltrados.slice(0, 50).map(cliente => (
                      <button key={cliente.id} onClick={() => { setClienteSelecionado(cliente); setMostrarListaClientes(false); setBuscaCliente('') }} className="w-full px-3 py-2.5 text-left hover:bg-green-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0">
                        <div className="size-9 rounded-full bg-green-100 text-green-700 grid place-items-center text-xs font-bold">{(cliente.nome || 'C').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}</div>
                        <div><p className="font-medium text-sm">{cliente.nome}</p><p className="text-xs text-gray-500">{cliente.telefone}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Endereço (se delivery) */}
            {tipoEntrega === 'delivery' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-green-600" /> Endereço</h3>
                <div className="space-y-4">
                  <BairroSelector bairros={bairros} selecionado={bairroSelecionado} onSelect={setBairroSelecionado} />
                  <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua / Avenida" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                    <input type="text" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Complemento" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                  </div>
                  {bairroSelecionado && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
                      <span className="text-sm">Taxa de entrega:</span><span className="font-bold text-amber-800">{formatCurrency(bairroSelecionado.taxa)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pagamento (não para mesa) */}
            {tipoEntrega !== 'mesa' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-green-600" /> Pagamento</h3>
                <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="w-full mb-3 px-4 py-3 border border-gray-200 rounded-xl text-sm">
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                </select>
                {formaPagamento === 'dinheiro' && (
                  <>
                    <input type="number" step="0.01" placeholder="Valor pago pelo cliente" value={valorPago} onChange={(e) => setValorPago(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                    {troco > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mt-3">
                        <p className="text-sm text-amber-800">Troco para: <strong>{formatCurrency(parseFloat(valorPago))}</strong></p>
                        <p className="font-bold text-amber-900 text-lg">Voltar: {formatCurrency(troco)}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Coluna 2: Produtos + Itens */}
          <div className="lg:col-span-2 space-y-5">
            {/* Produtos */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4">Produtos</h3>
              {produtos.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><p>Nenhum produto cadastrado</p></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {produtos.map(produto => (
                    <button key={produto.id} onClick={() => abrirSelecaoProduto(produto)} className="p-3 border border-gray-200 rounded-xl text-left hover:border-green-500 hover:bg-green-50 transition-all">
                      {produto.imagem_url ? <img src={produto.imagem_url} alt={produto.nome} className="w-full h-24 object-cover rounded-lg mb-2" /> : <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-300" /></div>}
                      <span className="font-medium text-sm line-clamp-2">{produto.nome}</span>
                      <p className="text-green-600 font-semibold text-sm mt-1">{formatCurrency(produto.preco)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Itens do Pedido */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h4 className="font-semibold mb-3">Itens do Pedido ({itens.length})</h4>
              {itens.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><p>Adicione produtos ao pedido</p></div>
              ) : (
                <div className="space-y-3">
                  {itens.map(item => {
                    const valorComps = calcularTotalComplementos(item.complementos, item.quantidade)
                    const valorTotal = (item.valor_unitario * item.quantidade) + valorComps
                    return (
                      <div key={item.id} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex gap-3">
                          {item.imagem_url && <img src={item.imagem_url} alt={item.nome} className="w-16 h-16 rounded-lg object-cover shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div><p className="font-semibold">{item.nome}</p><p className="text-sm text-gray-500">{formatCurrency(item.valor_unitario)} cada</p></div>
                              <p className="font-bold text-green-600">{formatCurrency(valorTotal)}</p>
                            </div>
                            {item.complementos.length > 0 && (
                              <div className="mt-2 space-y-1">{item.complementos.map(c => <p key={c.id} className="text-xs text-gray-500">+ {c.quantidade}x {c.nome}{c.valor > 0 && ` (${formatCurrency(c.valor * c.quantidade)})`}</p>)}</div>
                            )}
                            {item.observacao && <p className="text-xs text-gray-400 mt-1 italic">Obs: {item.observacao}</p>}
                            <div className="flex items-center gap-2 mt-3">
                              <button onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                              <span className="font-bold w-6 text-center">{item.quantidade}</span>
                              <button onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                              <button onClick={() => editarItem(item)} className="ml-auto px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</button>
                              <button onClick={() => removerItem(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Totais */}
            {itens.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(total - (tipoEntrega === 'delivery' && bairroSelecionado ? Number(bairroSelecionado.taxa) : 0))}</span></div>
                {totalComplementos > 0 && <div className="flex justify-between text-sm text-green-600"><span>Complementos</span><span>+ {formatCurrency(totalComplementos)}</span></div>}
                {tipoEntrega === 'delivery' && bairroSelecionado && <div className="flex justify-between text-sm"><span>Taxa de entrega ({bairroSelecionado.bairro})</span><span>{formatCurrency(Number(bairroSelecionado.taxa))}</span></div>}
                <div className="flex justify-between text-xl font-bold pt-2 border-t"><span>Total</span><span className="text-green-600">{formatCurrency(total)}</span></div>
              </div>
            )}

            {/* Botão Finalizar */}
            <button onClick={criarPedido} disabled={loading || itens.length === 0 || (tipoEntrega === 'delivery' && !bairroSelecionado)} className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg">
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Check className="w-5 h-5" /> Finalizar Pedido</>}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ClienteModal isOpen={mostrarModalCliente} onClose={() => setMostrarModalCliente(false)} onSave={cadastrarCliente} />
      <ProdutoModal isOpen={mostrarModalProduto} onClose={() => { setMostrarModalProduto(false); setProdutoSelecionado(null); setItemEditando(null) }} produto={produtoSelecionado} listas={listasDoProduto} onAdd={adicionarItem} initialItem={itemEditando || undefined} onReplace={substituirItem} />

      {/* Tela de Sucesso */}
      {pedidoCriado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="rounded-3xl p-8 w-full max-w-lg text-center shadow-2xl bg-white">
            <div className="size-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-green-600"><Check size={36} className="text-white" /></div>
            <h2 className="text-2xl font-bold mb-2">Pedido criado!</h2>
            <p className="text-gray-500 mb-6">{clienteSelecionado?.nome || mesaClienteNome || 'Mesa'} • {formatCurrency(pedidoCriado.valor_total)}</p>
            {whatsappMsg && (
              <div className="p-4 rounded-2xl text-left mb-6 bg-green-50 border border-green-200">
                <div className="text-xs font-semibold mb-2 text-green-700">📱 Mensagem WhatsApp</div>
                <pre className="text-xs whitespace-pre-wrap break-all font-mono text-gray-700" style={{ maxHeight: 200, overflowY: 'auto' }}>{whatsappMsg}</pre>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={copiarMsg} className="flex-1 px-4 py-3 rounded-2xl font-medium border border-gray-300">📋 Copiar</button>
              <button onClick={novoPedido} className="flex-1 px-4 py-3 rounded-2xl font-medium bg-green-600 text-white">← Novo Pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
