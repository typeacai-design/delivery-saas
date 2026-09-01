'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Plus, Minus, ShoppingCart, Clock, MapPin, User, Phone, CreditCard, Calendar, MessageSquare, ChevronDown, Tag, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatBirthdayInput, isValidBirthday, birthdayToIso } from '@/lib/checkout-date'
import { gerarMensagemWhatsApp } from '@/lib/whatsapp/template'

// ============================================================
// TIPOS
// ============================================================
export interface CartItem {
  id: string
  produto_id: string
  nome: string
  quantidade: number
  valor_unitario: number
  variante_id?: string
  variante_nome?: string
  variante_preco?: number
  complementos: CartComplemento[]
  tempo_preparo_min?: number
  observacao?: string
}

export interface CartComplemento {
  id: string
  nome: string
  quantidade: number
  valor: number
}

export interface EnderecoEntrega {
  id: string
  bairro: string
  taxa: number
  tempo_entrega_min?: number
  prazo_min?: number
}

export interface FormaPagamento {
  id: string
  nome: string
  icone?: string
}

export interface ClienteLocal {
  nome: string
  whatsapp: string
  aniversario: string
  endereco: string
  numero: string
  bairro: string
  complemento: string
  observacoes: string
  tipo_recebimento?: 'delivery' | 'retirada'
  cpf?: string
  accessToken?: string
  latitude?: number
  longitude?: number
}

// ============================================================
// KEY do localStorage
// ============================================================

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatPhone(v: string) {
  const c = (v || '').replace(/\D/g, '').slice(0, 11)
  return c.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

function normalizeCpf(v: string) { return (v || '').replace(/\D/g, '').slice(0, 11) }
function formatCpf(v: string) { return normalizeCpf(v).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2') }
function validCpf(v: string) {
  const cpf = normalizeCpf(v)
  if (!cpf) return true
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (size: number) => {
    let sum = 0
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i)
    const value = (sum * 10) % 11
    return value === 10 ? 0 : value
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

function gerarSlug(texto: string) {
  return texto.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}
function keepFocusInside(dialog: HTMLElement, event: KeyboardEvent) { if(event.key!=='Tab')return;const items=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')];if(!items.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()} }

// ============================================================
// COMPONENTE PRINCIPAL: CheckoutDrawer
// ============================================================
interface CheckoutDrawerProps {
  isOpen: boolean
  startAtCustomer?: boolean
  onClose: () => void
  itens: CartItem[]
  onUpdateQuantity: (itemId: string, quantidade: number) => void
  onRemoveItem: (itemId: string) => void
  onEditItem?: (item: CartItem) => void
  onLimparCarrinho: () => void
  tenantId: string
  tenantSlug?: string
  tenantNome: string
  tenantTelefone: string
  tenantEndereco?: string
  enderecos: EnderecoEntrega[]
  formasPagamento: FormaPagamento[]
  entregaConfig?: any
  valorMinimoPedido?: number
  onPedidoCriado?: (pedido: any) => void
  onClienteCadastrado?: (cliente: any) => void
}

export function CheckoutDrawer({
  isOpen,
  startAtCustomer = false,
  onClose,
  itens,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  onLimparCarrinho,
  tenantId,
  tenantSlug,
  tenantNome,
  tenantTelefone,
  tenantEndereco = '',
  enderecos,
  formasPagamento,
  entregaConfig,
  valorMinimoPedido = 0,
  onPedidoCriado,
  onClienteCadastrado,
}: CheckoutDrawerProps) {
  const newIdempotencyKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  }
  const idempotencyKey = useRef('')
  if (!idempotencyKey.current && typeof crypto !== 'undefined') idempotencyKey.current = newIdempotencyKey()
  const clienteKey = `delivery_cliente_dados_${tenantSlug || tenantId}`
  const carrinhoKey = `delivery_carrinho_${tenantSlug || tenantId}`
  const [step, setStep] = useState<'carrinho' | 'cliente' | 'entrega' | 'pagamento' | 'aniversario' | 'observacoes' | 'confirmacao'>('carrinho')

  useEffect(() => {
    if (isOpen && startAtCustomer) setStep('cliente')
  }, [isOpen, startAtCustomer])
  useEffect(()=>{if(!isOpen)return;const previous=document.activeElement as HTMLElement|null;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();const d=document.querySelector<HTMLElement>('.wd-checkout-dialog');if(d)keepFocusInside(d,e)};document.addEventListener('keydown',onKey);requestAnimationFrame(()=>document.querySelector<HTMLElement>('.wd-checkout-dialog button, .wd-checkout-dialog input')?.focus());return()=>{document.removeEventListener('keydown',onKey);previous?.focus()}},[isOpen,onClose])

  // Dados do cliente (persisted in localStorage)
  const [cliente, setCliente] = useState<ClienteLocal>(() => {
    if (typeof window !== 'undefined') {
      let saved = localStorage.getItem(clienteKey)
      if (!saved) {
        const legacy = localStorage.getItem('delivery_cliente_dados')
        if (legacy) { try { const parsed = JSON.parse(legacy); if (parsed.tenantSlug === tenantSlug) { saved = legacy; localStorage.setItem(clienteKey, legacy) } } catch { /* legado ignorado */ } }
      }
      if (saved) {
        try { return JSON.parse(saved) } catch { /* ignore */ }
      }
    }
    return { nome: '', whatsapp: '', aniversario: '', endereco: '', numero: '', bairro: '', complemento: '', observacoes: '', cpf: '', accessToken: '' }
  })

  // Bairro selecionado
  const [bairroSelecionado, setBairroSelecionado] = useState<EnderecoEntrega | null>(null)

  useEffect(() => {
    if (!cliente.bairro || bairroSelecionado) return
    const correspondente = enderecos.find((item) => item.bairro === cliente.bairro)
    if (correspondente) setBairroSelecionado(correspondente)
  }, [cliente.bairro, bairroSelecionado, enderecos])

  // Forma de pagamento selecionada (múltiplas)
  const [formasPagamentoSelecionadas, setFormasPagamentoSelecionadas] = useState<{ forma: string; valor: number }[]>([])

  // Troco para
  const [trocoPara, setTrocoPara] = useState('')
  const [precisaTroco, setPrecisaTroco] = useState(false)

  // Cupom
  const [cupomCodigo, setCupomCodigo] = useState('')
  const [cupomAplicado, setCupomAplicado] = useState<{ tipo: 'percentual' | 'fixo', valor: number, desconto: number } | null>(null)
  const [cupomLoading, setCupomLoading] = useState(false)
  const [cupomErro, setCupomErro] = useState('')

  // Observação geral do pedido
  const [observacaoPedido, setObservacaoPedido] = useState('')

  // Carregar carrinho do localStorage
  const [carrinhoLocal, setCarrinhoLocal] = useState<CartItem[]>(itens)

  // Salvando cliente no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(clienteKey, JSON.stringify({ ...cliente, tenantSlug }))
    }
  }, [cliente, clienteKey, tenantSlug])

  useEffect(() => {
    const atualizarDoNavegador = () => {
      try {
        const saved = localStorage.getItem(clienteKey)
        if (saved) setCliente(JSON.parse(saved))
      } catch { /* dados locais inválidos são ignorados */ }
    }
    window.addEventListener('delivery-cliente-updated', atualizarDoNavegador)
    return () => window.removeEventListener('delivery-cliente-updated', atualizarDoNavegador)
  }, [clienteKey])

  // Sync carrinho local com props
  useEffect(() => {
    setCarrinhoLocal(itens)
  }, [itens])

  // Cálculos
  const subtotal = useMemo(() => {
    return carrinhoLocal.reduce((acc, item) => {
      const complementosTotal = item.complementos.reduce((sum, c) => sum + (c.valor * c.quantidade), 0)
      const variantePreco = item.variante_preco || 0
      return acc + ((item.valor_unitario + variantePreco + complementosTotal) * item.quantidade)
    }, 0)
  }, [carrinhoLocal])

  const distanciaKm = Number((cliente as any).distancia_km || 0)
  const taxaKmRaw = Math.max(Number(entregaConfig?.km?.minimo || 0), distanciaKm * Number(entregaConfig?.km?.valor_km || 0))
  const taxaKm = entregaConfig?.km?.arredondamento === 'ceil' ? Math.ceil(taxaKmRaw) : entregaConfig?.km?.arredondamento === 'round' ? Math.round(taxaKmRaw) : taxaKmRaw
  const taxaEntrega = entregaConfig?.metodo === 'km' ? taxaKm : (bairroSelecionado?.taxa || 0)
  const tipoRecebimento = cliente.tipo_recebimento || 'delivery'
  const taxaEntregaAplicada = tipoRecebimento === 'retirada' ? 0 : taxaEntrega
  const descontoCupom = cupomAplicado?.desconto || 0
  const total = Math.max(0, subtotal + taxaEntregaAplicada - descontoCupom)

  const totalItens = carrinhoLocal.reduce((acc, item) => acc + item.quantidade, 0)

  // Calcula tempo de preparo
  const tempoPreparo = carrinhoLocal.reduce((max, item) => {
    const t = item.tempo_preparo_min || 30
    return Math.max(max, t)
  }, 0)

  const tempoEntrega = bairroSelecionado?.prazo_min || bairroSelecionado?.tempo_entrega_min || 15
  const tempoTotal = tempoPreparo + tempoEntrega

  function formatFaixaTempo(min: number): string {
    if (min <= 0) return ''
    const minFaixa = Math.max(5, Math.round(min * 0.9))
    const maxFaixa = Math.round(min * 1.2)
    if (minFaixa === maxFaixa) return `${minFaixa} min`
    return `${minFaixa}-${maxFaixa} min`
  }

  // ============================================================
  // VALIDAÇÕES
  // ============================================================
  const validarCliente = () => {
    if (!cliente.nome.trim()) return 'Informe seu nome'
    if (!cliente.whatsapp || cliente.whatsapp.replace(/\D/g, '').length < 10) return 'Informe um WhatsApp válido'
    if (cliente.cpf && !validCpf(cliente.cpf)) return 'Informe um CPF válido ou deixe o campo vazio'
    return null
  }

  const validarEntrega = () => {
    if (tipoRecebimento === 'retirada') return null
    if (!cliente.endereco.trim()) return 'Informe o endereço de entrega'
    if (entregaConfig?.metodo === 'km') {
      if (!cliente.latitude || !cliente.longitude || !(cliente as any).distancia_km) return 'Selecione um endereço válido nas sugestões para calcular a rota'
    } else if (!bairroSelecionado) return 'Selecione o bairro de entrega'
    return null
  }

  const podeFinalizar = () => {
    if (carrinhoLocal.length === 0) return false
    if (formasPagamentoSelecionadas.length === 0) return false
    // Validar que a soma dos valores >= total
    const totalPago = formasPagamentoSelecionadas.reduce((sum, fp) => sum + fp.valor, 0)
    if (totalPago < total) return false
    if (precisaTroco && !trocoPara) return false
    if (valorMinimoPedido && subtotal < valorMinimoPedido) return false
    return true
  }

  // ============================================================
  // APLIACR CUPOM
  // ============================================================
  const aplicarCupom = async () => {
    if (!cupomCodigo.trim()) return
    setCupomLoading(true)
    setCupomErro('')

    try {
      const res = await fetch(`/api/cupom/validar?tenant=${tenantId}&codigo=${cupomCodigo.trim()}&valor=${subtotal}`)
      const data = await res.json()

      if (!res.ok || !data.valido) {
        setCupomErro(data.mensagem || 'Cupom inválido')
        setCupomAplicado(null)
        return
      }

      const desconto = data.tipo === 'percentual'
        ? subtotal * (data.valor / 100)
        : Math.min(data.valor, subtotal)

      setCupomAplicado({ tipo: data.tipo, valor: data.valor, desconto })
    } catch {
      setCupomErro('Erro ao validar cupom')
    } finally {
      setCupomLoading(false)
    }
  }

  // ============================================================
  // FINALIZAR PEDIDO
  // ============================================================
  const [finalizando, setFinalizando] = useState(false)
  const [pedidoFinalizado, setPedidoFinalizado] = useState<any>(null)
  const [erroFinalizar, setErroFinalizar] = useState('')

  const finalizarPedido = async () => {
    if (!podeFinalizar()) return
    setFinalizando(true)
    setErroFinalizar('')

    try {
      let accessToken = cliente.accessToken
      if (!accessToken) {
        const bytes = crypto.getRandomValues(new Uint8Array(32))
        accessToken = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
        setCliente((current: ClienteLocal) => ({ ...current, accessToken }))
      }
      // 1. Cadastrar/atualizar cliente — também via rota pública
      try {
        const clienteRes = await fetch('/api/clientes/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            nome: cliente.nome,
            telefone: cliente.whatsapp,
            data_nascimento: cliente.aniversario ? birthdayToIso(cliente.aniversario) : null,
            cpf: cliente.cpf || null,
            access_token: accessToken,
            endereco: `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ''}${cliente.complemento ? ` - ${cliente.complemento}` : ''}`,
          }),
        })
        if (clienteRes.ok) {
          const clienteData = await clienteRes.json()
          onClienteCadastrado?.({ ...cliente, accessToken, nome: clienteData.nome || cliente.nome, whatsapp: clienteData.telefone || cliente.whatsapp })
        }
      } catch {
        // Não bloqueia o pedido
      }

      // 2. Criar pedido via rota pública (não exige login do cliente)
      const pedidoPayload = {
        tenant_slug: tenantSlug,
        cliente_nome: cliente.nome,
        cliente_whatsapp: cliente.whatsapp,
        itens: carrinhoLocal.map(item => ({
          produto_id: item.produto_id,
          nome: item.nome,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          variante_id: item.variante_id || null,
          variante_nome: item.variante_nome || null,
          complementos: item.complementos,
          observacao: item.observacao || '',
        })),
        valor_subtotal: subtotal,
        taxa_entrega: taxaEntregaAplicada,
        valor_desconto: descontoCupom,
        valor_total: total,
        // Múltiplas formas de pagamento
        formas_pagamento: formasPagamentoSelecionadas.map(fp => ({
          forma: fp.forma,
          valor: fp.valor
        })),
        troco_para: precisaTroco && trocoPara ? parseFloat(trocoPara) : null,
        bairro_entrega: bairroSelecionado?.bairro || '',
        taxa_bairro: taxaEntregaAplicada,
        endereco_entrega: cliente.endereco,
        numero_entrega: cliente.numero,
        complemento_entrega: cliente.complemento,
        cliente_latitude: cliente.latitude || null,
        cliente_longitude: cliente.longitude || null,
        tipo_entrega: tipoRecebimento,
        cliente_aniversario: cliente.aniversario ? birthdayToIso(cliente.aniversario) : null,
        cliente_cpf: cliente.cpf || null,
        cliente_access_token: accessToken,
        observacoes: observacaoPedido,
        cupom_aplicado: cupomAplicado ? cupomCodigo.trim().toUpperCase() : null,
        tempo_estimado_min: tempoTotal,
      }

      const pedidoRes = await fetch('/api/pedidos/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify(pedidoPayload),
      })

      if (!pedidoRes.ok) {
        const erroData = await pedidoRes.json()
        throw new Error(erroData.error || 'Erro ao criar pedido')
      }

      let pedido = await pedidoRes.json()
      // NÃO processamos pagamento aqui - o cliente seleciona a forma e conversa com o lojista via WhatsApp
      setPedidoFinalizado(pedido)
      setStep('confirmacao')
      onPedidoCriado?.(pedido)
      idempotencyKey.current = newIdempotencyKey()

    } catch (err: any) {
      setErroFinalizar(err.message || 'Erro ao finalizar pedido')
    } finally {
      setFinalizando(false)
    }
  }

  // ============================================================
  // ENVIAR WHATSAPP
  // ============================================================
  function enviarWhatsApp(pedido?: any) {
    // Formatar pagamentos múltiplos para exibição
    const pagamentosTexto = formasPagamentoSelecionadas
      .map(fp => {
        const formaNome = formasPagamento.find(f => f.id === fp.forma)?.nome || fp.forma
        return `${formaNome}: ${formatCurrency(fp.valor)}`
      })
      .join(', ')

    const mensagemUnificada = gerarMensagemWhatsApp({
      pedidoId: pedido?.id || String(Date.now()),
      pedidoCodigo: pedido?.codigo || null,
      tenantNome, clienteNome: cliente.nome,
      clienteWhatsapp: cliente.whatsapp,
      itens: carrinhoLocal.map(item => ({ nome: item.nome, quantidade: item.quantidade,
        valor_unitario: item.valor_unitario + (item.variante_preco || 0), variante_nome: item.variante_nome,
        complementos: item.complementos, observacao: item.observacao })),
      subtotal, taxaEntrega: taxaEntregaAplicada, desconto: pedido?.valor_desconto ?? descontoCupom,
      total: pedido?.valor_total ?? total, formaPagamento: pagamentosTexto,
      trocoPara: precisaTroco && trocoPara ? Number(trocoPara) : undefined,
      endereco: tipoRecebimento === 'retirada' ? tenantEndereco : cliente.endereco,
      numero: tipoRecebimento === 'retirada' ? '' : cliente.numero,
      complemento: tipoRecebimento === 'retirada' ? undefined : cliente.complemento,
      bairro: tipoRecebimento === 'retirada' ? '' : (bairroSelecionado?.bairro || ''),
      observacoes: observacaoPedido, tipoEntrega: tipoRecebimento,
    })
    const telefoneUnificado = tenantTelefone?.replace(/\D/g, '') || ''
    window.open(`https://wa.me/55${telefoneUnificado}?text=${encodeURIComponent(mensagemUnificada)}`, '_blank')
    onLimparCarrinho()
    localStorage.removeItem(carrinhoKey)
    return
  }

  // ============================================================
  // RENDER
  // ============================================================
  if (!isOpen) return null

  // TELA DE CONFIRMAÇÃO
  if (step === 'confirmacao') {
    return (
      <ModalConfirmacao
        pedido={pedidoFinalizado}
        cliente={cliente}
        total={total}
        tempoTotal={tempoTotal}
        tenantNome={tenantNome}
        onFechar={() => {
          setStep('carrinho')
          onLimparCarrinho()
          onClose()
          setPedidoFinalizado(null)
          // Mantém o cadastro local do cliente para a próxima compra.
          setBairroSelecionado(null)
          setFormasPagamentoSelecionadas([])
          setCupomAplicado(null)
          setObservacaoPedido('')
        }}
        onEnviarWhatsApp={() => enviarWhatsApp(pedidoFinalizado)}
      />
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Finalização do pedido" className="wd-checkout-dialog wd-overlay fixed right-0 top-0 bottom-0 w-full max-w-md z-50 shadow-2xl flex flex-col animate-slide-in md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[90vh] md:rounded-3xl md:overflow-hidden">
        {/* Header */}
        <div className="wd-overlay-header flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {step !== 'carrinho' && (
              <button onClick={() => {
                if (step === 'entrega') setStep('cliente')
                else if (step === 'pagamento') setStep('entrega')
                else if (step === 'aniversario') setStep('pagamento')
                else if (step === 'observacoes') setStep('aniversario')
                else if (step === 'cliente') setStep('carrinho')
              }} className="p-1.5 hover:bg-gray-100 rounded-full">
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
            )}
            <h2 className="font-bold text-lg">
              {step === 'carrinho' ? 'Seu Pedido' :
               step === 'cliente' ? 'Seus Dados' :
               step === 'entrega' ? 'Entrega' :
               step === 'pagamento' ? 'Pagamento' :
               step === 'aniversario' ? 'Aniversario' : 'Observacoes'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar finalização" className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        {step !== 'carrinho' && (
          <div className="wd-progress px-4 py-2 border-b flex items-center gap-2 overflow-x-auto text-xs" aria-label="Progresso do pedido">{(['cliente','entrega','pagamento','aniversario','observacoes'] as const).map((id,i)=>{const labels=['Dados','Entrega','Pagamento','Identificacao','Revisao'];const atual=['cliente','entrega','pagamento','aniversario','observacoes'].indexOf(step);return <span key={id} className={`whitespace-nowrap ${i===atual?'font-bold':''}`} aria-current={i===atual?'step':undefined}>{i<atual?'✓ ':''}{labels[i]}{i<4?' →':''}</span>})}</div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'carrinho' && (
            <CarrinhoView
              itens={carrinhoLocal}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveItem={onRemoveItem}
              onEditItem={onEditItem}
              onContinuar={() => {
                if (carrinhoLocal.length === 0) return
                setStep('cliente')
              }}
              valorMinimoPedido={valorMinimoPedido}
              subtotal={subtotal}
            />
          )}

          {step === 'cliente' && (
            <ClienteView
              cliente={cliente}
              setCliente={setCliente}
              onContinuar={async () => {
                const erro = validarCliente()
                if (erro) { alert(erro); return }
                let accessToken = cliente.accessToken
                if (!accessToken) {
                  const bytes = crypto.getRandomValues(new Uint8Array(32))
                  accessToken = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
                  setCliente((current: ClienteLocal) => ({ ...current, accessToken }))
                }
                if (tenantSlug) {
                  const response = await fetch('/api/clientes/public', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenant_slug: tenantSlug, nome: cliente.nome, telefone: cliente.whatsapp, data_nascimento: cliente.aniversario ? birthdayToIso(cliente.aniversario) : null, cpf: cliente.cpf || null, access_token: accessToken }),
                  })
                  const result = await response.json()
                  if (!response.ok && result.code !== 'NEW_ORDER_REQUIRED') { alert(result.error || 'Não foi possível salvar seus dados.'); return }
                  if (result.code === 'NEW_ORDER_REQUIRED') { setStep('entrega'); return }
                  onClienteCadastrado?.({ ...cliente, accessToken, ...(result.cliente || result), whatsapp: (result.cliente || result).telefone || cliente.whatsapp, aniversario: cliente.aniversario })
                }
                setStep('entrega')
              }}
            />
          )}

          {step === 'entrega' && (
            <EntregaView
              cliente={cliente}
              setCliente={setCliente}
              bairroSelecionado={bairroSelecionado}
              setBairroSelecionado={setBairroSelecionado}
              enderecos={enderecos}
              taxaEntrega={taxaEntrega}
              tenantEndereco={tenantEndereco}
              entregaConfig={entregaConfig}
              tenantSlug={tenantSlug}
              onContinuar={() => {
                const erro = validarEntrega()
                if (erro) { alert(erro); return }
                setStep('pagamento')
              }}
            />
          )}

          {step === 'pagamento' && (
            <PagamentoView
              formasPagamento={formasPagamento}
              formasSelecionadas={formasPagamentoSelecionadas}
              setFormasSelecionadas={setFormasPagamentoSelecionadas}
              trocoPara={trocoPara}
              setTrocoPara={setTrocoPara}
              precisaTroco={precisaTroco}
              setPrecisaTroco={setPrecisaTroco}
              total={total}
              cupomCodigo={cupomCodigo}
              setCupomCodigo={setCupomCodigo}
              cupomAplicado={cupomAplicado}
              setCupomAplicado={setCupomAplicado}
              cupomErro={cupomErro}
              setCupomErro={setCupomErro}
              cupomLoading={cupomLoading}
              onAplicarCupom={aplicarCupom}
              observacaoPedido={observacaoPedido}
              setObservacaoPedido={setObservacaoPedido}
              subtotal={subtotal}
              taxaEntrega={taxaEntregaAplicada}
              descontoCupom={descontoCupom}
              onContinuar={() => {
                if (formasPagamentoSelecionadas.length === 0) { alert('Selecione pelo menos uma forma de pagamento'); return }
                const totalPago = formasPagamentoSelecionadas.reduce((sum, fp) => sum + fp.valor, 0)
                if (totalPago < total) { alert('A soma dos valores pagos deve ser maior ou igual ao total'); return }
                if (precisaTroco && !trocoPara) { alert('Informe o valor para troco'); return }
                setStep('aniversario')
              }}
            />
          )}
          {step === 'aniversario' && (
            <AniversarioView
              cliente={cliente}
              setCliente={setCliente}
              onContinuar={() => setStep('observacoes')}
            />
          )}
          {step === 'observacoes' && (
            <ObservacoesView observacaoPedido={observacaoPedido} setObservacaoPedido={setObservacaoPedido} itens={carrinhoLocal} subtotal={subtotal} taxaEntrega={taxaEntregaAplicada} desconto={descontoCupom} total={total} />
          )}
        </div>

        {/* Footer */}
        {step === 'observacoes' && (
          <div className="wd-overlay-footer border-t p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total</span>
              <span className="wd-accent-text font-bold text-xl">{formatCurrency(total)}</span>
            </div>

            {tempoTotal > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  Pronto em <strong>{formatFaixaTempo(tempoTotal)}</strong>
                </span>
              </div>
            )}

            {erroFinalizar && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {erroFinalizar}
              </div>
            )}

            <button type="button" onClick={onClose} className="wd-secondary-action w-full py-3 rounded-2xl font-semibold border-2">
                Adicionar outro produto
            </button>
            <button
              onClick={finalizarPedido}
              disabled={!podeFinalizar() || finalizando}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-lg disabled:opacity-50"
              style={{
                background: podeFinalizar() ? 'var(--cardapio-button)' : '#9CA3AF',
                boxShadow: podeFinalizar() ? '0 0 0 4px rgba(34,197,94,.25), 0 8px 24px -8px rgba(22,163,74,.5)' : 'none',
              }}
            >
              {finalizando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Finalizar Pedido
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}

// ============================================================
// SUB-VIEWS
// ============================================================

function CarrinhoView({ itens, onUpdateQuantity, onRemoveItem, onEditItem, onContinuar, valorMinimoPedido, subtotal }: any) {
  if (itens.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12 text-gray-500">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Carrinho vazio</p>
          <p className="text-sm mt-1">Adicione itens do cardápio</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {itens.map((item: any) => {
        const subTotal = (
          (item.valor_unitario + (item.variante_preco || 0) +
            item.complementos.reduce((s: number, c: any) => s + c.valor * c.quantidade, 0)) *
          item.quantidade
        )

        return (
          <div key={item.id} className="wd-panel rounded-xl p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold">{item.nome}</h3>
                {item.variante_nome && <p className="text-sm text-gray-500">{item.variante_nome}</p>}
                {item.complementos.length > 0 && (
                  <div className="mt-1">
                    {item.complementos.map((c: any) => (
                      <p key={c.id} className="text-xs text-gray-500">+ {c.quantidade}x {c.nome}</p>
                    ))}
                  </div>
                )}
              </div>
              <p className="wd-accent-text font-bold">{formatCurrency(subTotal)}</p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              {onEditItem && <button onClick={() => onEditItem(item)} className="px-2 py-1 text-xs font-medium text-green-700">Editar</button>}
              <button
                onClick={() => {
                  if (item.quantidade <= 1) onRemoveItem(item.id)
                  else onUpdateQuantity(item.id, item.quantidade - 1)
                }}
                className="p-1.5 bg-white rounded-full border hover:bg-gray-100"
              >
                {item.quantidade <= 1 ? <Trash2 className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4" />}
              </button>
              <span className="font-semibold w-8 text-center">{item.quantidade}</span>
              <button
                onClick={() => onUpdateQuantity(item.id, item.quantidade + 1)}
                className="p-1.5 bg-white rounded-full border hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}

      {valorMinimoPedido > 0 && subtotal < valorMinimoPedido && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Pedido mínimo: {formatCurrency(valorMinimoPedido)}
        </div>
      )}

      <button
        onClick={onContinuar}
        className="w-full py-4 rounded-2xl font-bold text-white text-lg"
        style={{
          background: 'var(--cardapio-button)',
          boxShadow: '0 8px 24px -8px rgba(22,163,74,.5)',
        }}
      >
        Continuar
      </button>
    </div>
  )
}

function ClienteView({ cliente, setCliente, onContinuar }: any) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-600 mb-4">Seus dados para contato e identificação</p>

      <div>
        <label className="block text-sm font-medium mb-1.5">Nome completo *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={cliente.nome}
            onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
            placeholder="Seu nome"
            className="w-full pl-10 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">WhatsApp *</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="tel"
            value={cliente.whatsapp}
            onChange={(e) => setCliente({ ...cliente, whatsapp: formatPhone(e.target.value) })}
            placeholder="(11) 99999-9999"
            className="w-full pl-10 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
        </div>
      </div>

      <button
        onClick={onContinuar}
        className="w-full py-4 rounded-2xl font-bold text-white text-lg"
        style={{ background: 'var(--cardapio-button)' }}
      >
        Continuar
      </button>
    </div>
  )
}

function AniversarioView({ cliente, setCliente, onContinuar }: any) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Data de aniversário <span className="font-normal text-gray-500">— opcional</span></label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" inputMode="numeric" value={cliente.aniversario} onChange={(e) => setCliente({...cliente,aniversario:formatBirthdayInput(e.target.value)})} placeholder="DD/MM/AAAA" maxLength={10} autoComplete="bday" aria-label="Data de nascimento opcional no formato dia, mês e ano" className="w-full pl-10 py-3 border rounded-xl outline-none" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Use DD/MM/AAAA ou deixe em branco.</p>
      </div>
      <div><label className="block text-sm font-medium mb-1.5">CPF — opcional</label><input inputMode="numeric" value={formatCpf(cliente.cpf||'')} onChange={e=>setCliente({...cliente,cpf:normalizeCpf(e.target.value)})} placeholder="CPF — opcional" maxLength={14} className="w-full py-3 px-4 border rounded-xl outline-none"/></div>
      <button type="button" onClick={()=>{if(cliente.aniversario&&!isValidBirthday(cliente.aniversario)){alert('Informe uma data válida no formato DD/MM/AAAA ou deixe vazio');return}if(cliente.cpf&&!validCpf(cliente.cpf)){alert('Informe um CPF válido ou deixe vazio');return}onContinuar()}} className="wd-primary-action w-full py-4 rounded-2xl text-white font-bold text-lg">Continuar</button>
      <button type="button" onClick={()=>{setCliente({...cliente,aniversario:'',cpf:''});onContinuar()}} className="w-full py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">Pular esta etapa</button>
    </div>
  )
}

function EntregaView({ cliente, setCliente, bairroSelecionado, setBairroSelecionado, enderecos, taxaEntrega, tenantEndereco, entregaConfig, tenantSlug, onContinuar }: any) {
  const [mostrarBairros, setMostrarBairros] = useState(false)
  const [sugestoes,setSugestoes]=useState<any[]>([]); const [routeError,setRouteError]=useState('');const [mapConfigured,setMapConfigured]=useState<boolean|null>(null)
  useEffect(()=>{if(entregaConfig?.metodo!=='km')return;fetch('/api/mapbox/public',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',tenant_slug:tenantSlug})}).then(r=>r.json()).then(b=>{setMapConfigured(Boolean(b.configured));if(!b.configured)setRouteError('Entrega por quilômetro indisponível agora. Escolha retirada ou fale com a loja para usar entrega por bairro.')}).catch(()=>{setMapConfigured(false);setRouteError('Não foi possível carregar o cálculo de entrega.')})},[entregaConfig?.metodo])
  useEffect(()=>{if(entregaConfig?.metodo!=='km'||mapConfigured!==true||cliente.endereco?.length<3)return;const timer=setTimeout(async()=>{const r=await fetch('/api/mapbox/public',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',tenant_slug:tenantSlug,query:cliente.endereco})});const b=await r.json();if(!r.ok)setRouteError(b.error||'Busca de endereço indisponível');setSugestoes(b.suggestions||[])},350);return()=>clearTimeout(timer)},[cliente.endereco,entregaConfig?.metodo,tenantSlug,mapConfigured])
  const escolher=(s:any)=>{setSugestoes([]);setRouteError('');setCliente({...cliente,endereco:s.label,latitude:s.latitude,longitude:s.longitude,distancia_km:null,taxa_km:null})}
  const calcularRota=async()=>{if(mapConfigured!==true)return setRouteError('Entrega por quilômetro indisponível agora. Escolha retirada ou fale com a loja.');if(!cliente.endereco?.trim()||!cliente.numero?.trim())return setRouteError('Informe o endereço e o número.');const address=`${cliente.endereco}, ${cliente.numero}`;const r=await fetch('/api/mapbox/public',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'route',tenant_slug:tenantSlug,address,latitude:cliente.latitude,longitude:cliente.longitude})});const b=await r.json();if(!r.ok)return setRouteError(b.error);setRouteError('');setCliente((c:any)=>({...c,latitude:b.latitude,longitude:b.longitude,distancia_km:b.km,taxa_km:b.taxa}))}

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setCliente({ ...cliente, tipo_recebimento: 'delivery' })} className={`wd-option p-3 rounded-xl border-2 font-semibold ${(cliente.tipo_recebimento || 'delivery') === 'delivery' ? 'wd-option-selected' : ''}`}>Entrega</button>
        <button type="button" onClick={() => setCliente({ ...cliente, tipo_recebimento: 'retirada' })} className={`wd-option p-3 rounded-xl border-2 font-semibold ${cliente.tipo_recebimento === 'retirada' ? 'wd-option-selected' : ''}`}>Retirada</button>
      </div>
      {cliente.tipo_recebimento === 'retirada' && (
        <div className="wd-panel p-4 rounded-xl border">
          <p className="font-semibold">Endereco para retirada</p>
          <p className="wd-muted text-sm mt-1">{tenantEndereco || 'Consulte o endereco com a loja pelo WhatsApp.'}</p>
        </div>
      )}
      {cliente.tipo_recebimento !== 'retirada' && <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-4">Endereço de entrega</p>

      <div>
        <label className="block text-sm font-medium mb-1.5">Endereço</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={cliente.endereco}
            onChange={(e) => setCliente({ ...cliente, endereco: e.target.value, distancia_km:null, taxa_km:null })}
            placeholder="Rua, número, referência"
            className="w-full pl-10 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
          {entregaConfig?.metodo==='km'&&sugestoes.length>0&&<div className="relative"><div className="absolute z-20 top-0 bg-white border rounded-xl shadow w-full">{sugestoes.map(s=><button type="button" className="w-full text-left p-2 text-sm" key={s.id} onClick={()=>escolher(s)}>{s.label}</button>)}</div></div>}
          {entregaConfig?.metodo==='km'&&cliente.distancia_km&&<p className="text-xs text-green-700 mt-1">Rota: {Number(cliente.distancia_km).toFixed(2)} km · taxa {formatCurrency(Number(cliente.taxa_km||0))}</p>}
          {routeError&&<p className="text-xs text-red-600 mt-1">{routeError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Número</label>
          <input
            type="text"
            value={cliente.numero}
            onChange={(e) => setCliente({ ...cliente, numero: e.target.value, distancia_km:null, taxa_km:null })}
            placeholder="123"
            className="w-full py-3 px-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Complemento</label>
          <input
            type="text"
            value={cliente.complemento}
            onChange={(e) => setCliente({ ...cliente, complemento: e.target.value })}
            placeholder="Apto, bloco..."
            className="w-full py-3 px-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
        </div>
      </div>

      {entregaConfig?.metodo === 'km' && <button type="button" onClick={calcularRota} className="wd-secondary-action w-full py-3 rounded-xl border font-semibold">Calcular distância e taxa</button>}

      {entregaConfig?.metodo !== 'km' && <div>
        <label className="block text-sm font-medium mb-1.5">Bairro *</label>
        <button
          onClick={() => setMostrarBairros(!mostrarBairros)}
          className="w-full py-3 px-3 border rounded-xl text-left flex items-center justify-between bg-white"
        >
          <span className={bairroSelecionado ? 'text-gray-900' : 'text-gray-400'}>
            {bairroSelecionado ? `${bairroSelecionado.bairro} (${formatCurrency(bairroSelecionado.taxa)})` : 'Selecione o bairro'}
          </span>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${mostrarBairros ? 'rotate-180' : ''}`} />
        </button>

        {mostrarBairros && (
          <div className="mt-2 border rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            {enderecos.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">Nenhum bairro cadastrado</p>
            ) : (
              enderecos.map((end: any) => (
                <button
                  key={end.id}
                  onClick={() => {
                    setBairroSelecionado(end)
                    setCliente({ ...cliente, bairro: end.bairro })
                    setMostrarBairros(false)
                  }}
                  className={`w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center ${
                    bairroSelecionado?.id === end.id ? 'bg-green-50' : ''
                  }`}
                >
                  <span className="font-medium">{end.bairro}</span>
                  <span className="text-green-600 font-semibold">{formatCurrency(end.taxa)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>}

      {taxaEntrega > 0 && (
        <div className="wd-highlight p-3 rounded-xl border flex justify-between items-center">
          <span>Taxa de entrega</span><span className="wd-accent-text font-bold">{formatCurrency(taxaEntrega)}</span>
        </div>
      )}

      </div>}
      <button
        onClick={onContinuar}
        className="w-full py-4 rounded-2xl font-bold text-white text-lg"
        style={{ background: 'var(--cardapio-button)' }}
      >
        Continuar
      </button>
    </div>
  )
}

function PagamentoView({
  formasPagamento, formasSelecionadas, setFormasSelecionadas,
  trocoPara, setTrocoPara, precisaTroco, setPrecisaTroco, total,
  cupomCodigo, setCupomCodigo, cupomAplicado, setCupomAplicado, cupomErro, setCupomErro, cupomLoading, onAplicarCupom,
  subtotal, taxaEntrega, descontoCupom, onContinuar
}: any) {
  // Calcular valor restante para preencher automaticamente
  const totalSelecionado = formasSelecionadas.reduce((sum: number, fp: any) => sum + fp.valor, 0)
  const valorRestante = Math.max(0, total - totalSelecionado)

  // Toggle forma de pagamento
  const toggleFormaPagamento = (formaId: string) => {
    const jaSelecionada = formasSelecionadas.find((fp: any) => fp.forma === formaId)
    if (jaSelecionada) {
      // Remover
      setFormasSelecionadas(formasSelecionadas.filter((fp: any) => fp.forma !== formaId))
    } else {
      // Adicionar com valor restante (ou sugerido)
      const valorSugerido = valorRestante > 0 ? valorRestante : total
      setFormasSelecionadas([...formasSelecionadas, { forma: formaId, valor: Math.round(valorSugerido * 100) / 100 }])
    }
  }

  // Atualizar valor de uma forma
  const atualizarValor = (formaId: string, novoValor: number) => {
    setFormasSelecionadas(formasSelecionadas.map((fp: any) =>
      fp.forma === formaId ? { ...fp, valor: Math.round(novoValor * 100) / 100 } : fp
    ))
  }

  // Verificar se tem dinheiro selecionado
  const temDinheiro = formasSelecionadas.some((fp: any) => fp.forma === 'dinheiro')

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-600 mb-2">💳 Forma de pagamento</p>
      <p className="text-xs text-gray-500 -mt-2">Selecione uma ou mais formas de pagamento</p>

      {/* Formas de pagamento com checkbox */}
      <div className="space-y-2">
        {formasPagamento.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma forma de pagamento cadastrada</p>
        ) : (
          formasPagamento.map((fp: any) => {
            const selecionada = formasSelecionadas.find((fps: any) => fps.forma === fp.id)
            return (
              <div key={fp.id} className="border-2 rounded-xl overflow-hidden transition-all" style={{
                borderColor: selecionada ? '#22c55e' : '#e5e7eb',
                backgroundColor: selecionada ? '#f0fdf4' : 'white'
              }}>
                {/* Checkbox row */}
                <button
                  onClick={() => toggleFormaPagamento(fp.id)}
                  className="w-full p-4 flex items-center gap-3"
                >
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${selecionada ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                    {selecionada && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="font-medium">{fp.nome}</span>
                </button>

                {/* Campo de valor (se selecionada) */}
                {selecionada && (
                  <div className="px-4 pb-4 pt-1 border-t border-green-200">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Valor</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">R$</span>
                      <input
                        type="number"
                        value={selecionada.valor}
                        onChange={(e) => atualizarValor(fp.id, parseFloat(e.target.value) || 0)}
                        className="flex-1 py-2 px-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Resumo dos pagamentos */}
      {formasSelecionadas.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-medium text-blue-800">Pagamentos:</div>
          {formasSelecionadas.map((fp: any) => {
            const formaNome = formasPagamento.find((f: any) => f.id === fp.forma)?.nome || fp.forma
            return (
              <div key={fp.forma} className="flex justify-between text-sm">
                <span className="text-blue-700">{formaNome}</span>
                <span className="font-medium text-blue-900">{formatCurrency(fp.valor)}</span>
              </div>
            )
          })}
          <div className="border-t border-blue-200 pt-2 flex justify-between text-sm">
            <span className="font-medium text-blue-800">Total pago:</span>
            <span className="font-bold text-blue-900">{formatCurrency(totalSelecionado)}</span>
          </div>
          {totalSelecionado > total && (
            <div className="text-sm text-green-600 font-medium">
              ✓ Troco: {formatCurrency(totalSelecionado - total)}
            </div>
          )}
        </div>
      )}

      {/* Troco para (se dinheiro selecionado) */}
      {temDinheiro && (
        <div className="wd-panel mt-4 p-3 rounded-xl">
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <input
              type="checkbox"
              checked={precisaTroco}
              onChange={(e) => setPrecisaTroco(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Precisa de troco?
          </label>
          {precisaTroco && (
            <div className="space-y-2">
              <label className="block text-xs text-gray-500">Para quanto?</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R$</span>
                <input
                  type="number"
                  value={trocoPara}
                  onChange={(e) => setTrocoPara(e.target.value)}
                  placeholder="Ex: 50,00"
                  className="w-full pl-8 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              {trocoPara && parseFloat(trocoPara) > 0 && (
                <p className="text-sm text-green-600 font-medium">
                  Troco: {formatCurrency(parseFloat(trocoPara) - totalSelecionado)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cupom */}
      <div className="mt-4 pt-4 border-t">
        <label className="block text-sm font-medium mb-2">
          <Tag className="w-4 h-4 inline mr-1" />
          Cupom de desconto
        </label>
        {cupomAplicado ? (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between">
            <div>
              <span className="font-medium text-green-700">{cupomCodigo}</span>
              <span className="text-sm text-green-600 ml-2">
                -{cupomAplicado.tipo === 'percentual' ? `${cupomAplicado.valor}%` : formatCurrency(cupomAplicado.desconto)}
              </span>
            </div>
            <button
              onClick={() => { setCupomAplicado(null); setCupomCodigo('') }}
              className="text-red-500 text-sm"
            >
              Remover
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={cupomCodigo}
              onChange={(e) => { setCupomCodigo(e.target.value.toUpperCase()); setCupomErro('') }}
              placeholder="Código do cupom"
              className="flex-1 py-3 px-3 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none uppercase"
            />
            <button
              onClick={onAplicarCupom}
              disabled={!cupomCodigo.trim() || cupomLoading}
              className="px-4 py-3 bg-gray-900 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {cupomLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Aplicar'}
            </button>
          </div>
        )}
        {cupomErro && <p className="text-sm text-red-500 mt-1">{cupomErro}</p>}
      </div>

      {/* Resumo */}
      <div className="mt-4 pt-4 border-t space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {taxaEntrega > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Taxa de entrega</span>
            <span>{formatCurrency(taxaEntrega)}</span>
          </div>
        )}
        {descontoCupom > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Desconto</span>
            <span>-{formatCurrency(descontoCupom)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t">
          <span>Total do pedido</span>
          <span className="text-green-600">{formatCurrency(total)}</span>
        </div>
      </div>
      <button type="button" onClick={onContinuar} className="wd-primary-action w-full py-4 rounded-2xl text-white font-bold text-lg">Continuar</button>
    </div>
  )
}

function ObservacoesView({ observacaoPedido, setObservacaoPedido, itens, subtotal, taxaEntrega, desconto, total }: any) {
  return <div className="p-4 space-y-4">
    <div><h3 className="font-bold text-lg">Observacoes finais</h3><p className="text-sm text-gray-500">Inclua instruções gerais para a loja antes de concluir.</p></div>
    <textarea value={observacaoPedido} onChange={(e) => setObservacaoPedido(e.target.value)} placeholder="Ex: tocar interfone, enviar guardanapos..." rows={4} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none" />
    <div className="border rounded-2xl p-4 space-y-3"><h4 className="font-semibold">Resumo do pedido</h4>
      {itens.map((item: CartItem) => <div key={item.id} className="text-sm"><strong>{item.quantidade}x {item.nome}</strong>{item.complementos.length > 0 && <p className="text-gray-500">{item.complementos.map(c => `${c.quantidade}x ${c.nome}`).join(', ')}</p>}</div>)}
      <div className="pt-2 border-t text-sm space-y-1"><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>{taxaEntrega > 0 && <div className="flex justify-between"><span>Entrega</span><span>{formatCurrency(taxaEntrega)}</span></div>}{desconto > 0 && <div className="flex justify-between text-green-700"><span>Desconto</span><span>-{formatCurrency(desconto)}</span></div>}<div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(total)}</span></div></div>
    </div>
  </div>
}

function ModalConfirmacao({ pedido, cliente, total, tempoTotal, tenantNome, onFechar, onEnviarWhatsApp }: any) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="wd-overlay rounded-3xl w-full max-w-md p-8 text-center animate-slide-in">
          <div className="size-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-green-100">
            <Check className="w-10 h-10 text-green-600" />
          </div>

          <h2 className="text-2xl font-bold mb-2">Pedido Enviado!</h2>
          <p className="text-gray-600 mb-6">
            Seu pedido foi criado e enviado para <strong>{tenantNome || 'a loja'}</strong>.
            <br />Aguarde a confirmação pelo WhatsApp.
          </p>

          <div className="wd-panel rounded-2xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Pedido</span>
              <span className="font-bold text-green-600">{pedido?.codigo || `#${pedido?.id?.slice(-6) || '---'}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span className="font-bold text-green-600 text-lg">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tempo estimado</span>
              <span className="font-medium">~{Math.round(tempoTotal * 1.2)} min</span>
            </div>
          </div>

          {/* Pagamento é combinado via WhatsApp com o lojista */}

          {pedido?.contagem_pedidos > 1 && (
            <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-green-50 to-yellow-50 border border-green-200">
              <p className="text-sm font-medium text-green-800">
                🎉 Parabéns! Este é seu {pedido.contagem_pedidos}º pedido!
              </p>
            </div>
          )}
          {pedido?.contagem_pedidos === 1 && (
            <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200">
              <p className="text-sm font-medium text-blue-800">
                👋 Bem-vindo! Este é seu primeiro pedido na {tenantNome || 'loja'}!
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={onEnviarWhatsApp}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
              style={{
                background: 'var(--cardapio-button)',
                boxShadow: '0 8px 24px -8px rgba(22,163,74,.5)',
              }}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar via WhatsApp
            </button>

            <button
              onClick={onFechar}
              className="w-full py-3 text-gray-600 font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}

// ============================================================
// MODAL: SELEÇÃO DE PRODUTO (variantes e complementos)
// ============================================================
interface ProdutoModalProps {
  isOpen: boolean
  onClose: () => void
  produto: any
  variantes: any[]
  complementos: any[]
  listas?: any[]
  onAddToCart: (item: Omit<CartItem, 'id'>) => void
  onGoToCheckout?: () => void
  paletaCor: string
  initialItem?: CartItem | null
  onReplaceItem?: (itemId: string, item: Omit<CartItem, 'id'>) => void
}

export function ProdutoModal({
  isOpen,
  onClose,
  produto,
  variantes,
  complementos,
  listas = [],
  onAddToCart,
  onGoToCheckout,
  paletaCor,
  initialItem,
  onReplaceItem,
}: ProdutoModalProps) {
  const [quantidade, setQuantidade] = useState(1)
  const [varianteSelecionada, setVarianteSelecionada] = useState<string | null>(
    variantes.length === 1 ? variantes[0].id : null
  )
  const [complementosSelecionados, setComplementosSelecionados] = useState<{[key: string]: number}>({})
  const [observacao, setObservacao] = useState('')
  const [etapaLista, setEtapaLista] = useState(0)
  const [montagemConcluida, setMontagemConcluida] = useState(false)

  useEffect(() => {
    if (!isOpen || !produto) return
    setQuantidade(initialItem?.quantidade || 1)
    setVarianteSelecionada(initialItem?.variante_id || (variantes.length === 1 ? variantes[0].id : null))
    setComplementosSelecionados(Object.fromEntries((initialItem?.complementos || []).map(c => [c.id, c.quantidade])))
    setObservacao(initialItem?.observacao || '')
    setEtapaLista(0)
    setMontagemConcluida(false)
  }, [isOpen, produto, initialItem, variantes])
  useEffect(()=>{if(!isOpen)return;const previous=document.activeElement as HTMLElement|null;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();const d=document.querySelector<HTMLElement>('.wd-product-dialog');if(d)keepFocusInside(d,e)};document.addEventListener('keydown',onKey);requestAnimationFrame(()=>document.querySelector<HTMLElement>('.wd-product-dialog button')?.focus());return()=>{document.removeEventListener('keydown',onKey);previous?.focus()}},[isOpen,onClose])

  if (!isOpen || !produto) return null

  const variante = variantes.find(v => v.id === varianteSelecionada)
  const precoBase = produto.preco + (variante?.preco_adicional || 0)
  const precoComplementos = Object.entries(complementosSelecionados).reduce((acc, [id, qtd]) => {
    const comp = complementos.find(c => c.id === id)
    return acc + (comp?.preco || 0) * (qtd as number)
  }, 0)
  const total = (precoBase + precoComplementos) * quantidade

  function toggleComplemento(complementoId: string) {
    setComplementosSelecionados(prev => {
      if (prev[complementoId]) {
        const newPrev = { ...prev }
        delete newPrev[complementoId]
        return newPrev
      } else {
        return { ...prev, [complementoId]: 1 }
      }
    })
  }

  const listaAtual = listas[etapaLista]
  const quantidadeLista = listaAtual?.complementos?.reduce((s: number, c: any) => s + (complementosSelecionados[c.id] || 0), 0) || 0
  const minimoLista = Number(listaAtual?.qtd_minima ?? (listaAtual?.obrigatorio ? 1 : 0))
  const maximoLista = Number(listaAtual?.qtd_maxima ?? listaAtual?.max_selecoes ?? 99)

  function alterarComplemento(comp: any, delta: number) {
    setComplementosSelecionados(prev => {
      const atual = prev[comp.id] || 0
      const maxItem = listaAtual?.max_um_de_cada ? 1 : Number(comp.qtd_max || 99)
      const proximo = Math.max(0, Math.min(maxItem, atual + delta))
      if (delta > 0 && quantidadeLista >= maximoLista) return prev
      const novo = { ...prev }
      if (proximo) novo[comp.id] = proximo
      else delete novo[comp.id]
      return novo
    })
  }

  function avancarLista() {
    if (quantidadeLista < minimoLista) return
    if (etapaLista < listas.length - 1) setEtapaLista(v => v + 1)
    else adicionar(true)
  }

  function adicionar(finalizar = false) {
    const complementoItems = Object.entries(complementosSelecionados)
      .filter(([_, qtd]) => (qtd as number) > 0)
      .map(([id, qtd]) => {
        const comp = complementos.find(c => c.id === id)!
        return {
          id,
          nome: comp.nome,
          quantidade: qtd as number,
          valor: comp.preco
        }
      })

    const itemMontado: Omit<CartItem, 'id'> = {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade,
      valor_unitario: produto.preco,
      variante_id: variante?.id,
      variante_nome: variante?.nome,
      variante_preco: variante?.preco_adicional,
      complementos: complementoItems,
      tempo_preparo_min: produto.tempo_preparo_min || 30,
      observacao: observacao.trim() || undefined,
    }
    if (initialItem && onReplaceItem) onReplaceItem(initialItem.id, itemMontado)
    else onAddToCart(itemMontado)

    // Reset
    setQuantidade(1)
    setComplementosSelecionados({})
    setObservacao('')
    setEtapaLista(0)
    setMontagemConcluida(false)
    onClose()
    if (finalizar) onGoToCheckout?.()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-label={`Personalizar ${produto.nome}`} className="wd-product-dialog wd-overlay fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-3xl z-50 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <button onClick={onClose} aria-label="Fechar" className="wd-icon-button absolute top-4 right-4 z-10 p-2 rounded-full shadow-lg">
          <X className="w-5 h-5" />
        </button>
        {/* Imagem compacta somente na primeira etapa */}
        {etapaLista === 0 && <div className="relative px-5 pt-5">
          {produto.imagem_url ? (
            <img src={produto.imagem_url} alt={produto.nome} className="w-24 h-24 mx-auto rounded-2xl object-contain bg-gray-50" />
          ) : (
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
              <span className="text-4xl">🍽️</span>
            </div>
          )}
        </div>}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          {etapaLista === 0 && <><h2 className="text-xl font-bold text-center">{produto.nome}</h2>{produto.descricao && <p className="text-gray-600 mt-2 text-center">{produto.descricao}</p>}</>}

          {etapaLista === 0 && produto.tempo_preparo_min && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-sm text-amber-800">Pronto em <strong>{produto.tempo_preparo_min} min</strong></span>
            </div>
          )}

          {/* Variantes */}
          {etapaLista === 0 && variantes.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold text-sm mb-2">Selecione o tamanho</h3>
              <div className="flex flex-wrap gap-2">
                {variantes.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVarianteSelecionada(v.id)}
                    className={`px-4 py-2 rounded-full border-2 font-medium transition-all ${
                      varianteSelecionada === v.id ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    {v.nome}
                    {v.preco_adicional > 0 && <span className="ml-1 text-sm opacity-70">+ {formatCurrency(v.preco_adicional)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Complementos por lista, na ordem configurada */}
          {!montagemConcluida && listaAtual && (
            <div className="mt-5">
              <p className="text-xs text-gray-500 mb-1">Etapa {etapaLista + 1} de {listas.length}</p>
              <h3 className="text-xl font-bold mb-1 text-gray-900">{listaAtual.nome || 'Escolha seus complementos'}</h3>
              <p className="text-xs text-gray-500 mb-3">Escolha de {minimoLista} ate {maximoLista} itens ({quantidadeLista}/{maximoLista})</p>
              <div className="space-y-2">
                {listaAtual.complementos.map((comp: any) => (
                  <div
                    key={comp.id}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      complementosSelecionados[comp.id] ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {comp.imagem_url && <img src={comp.imagem_url} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                      <div><span className="font-medium block">{comp.nome}</span><span className="text-sm text-green-600">+ {formatCurrency(comp.preco)}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => alterarComplemento(comp, -1)} className="w-8 h-8 border rounded-full"><Minus className="w-4 h-4 mx-auto" /></button>
                      <strong>{complementosSelecionados[comp.id] || 0}</strong>
                      <button type="button" onClick={() => alterarComplemento(comp, 1)} className="w-8 h-8 border rounded-full"><Plus className="w-4 h-4 mx-auto" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Quantidade</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-full border flex items-center justify-center">
                <Minus className="w-5 h-5" />
              </button>
              <span className="font-bold text-xl w-8 text-center">{quantidade}</span>
              <button onClick={() => setQuantidade(q => q + 1)} className="w-10 h-10 rounded-full border flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {listas.length > 0 ? (
            <button disabled={quantidadeLista < minimoLista} onClick={avancarLista} className="wd-primary-action w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-40">Continuar</button>
          ) : <button onClick={() => adicionar(true)} className="wd-primary-action w-full py-4 rounded-2xl font-bold text-white text-lg">Continuar {formatCurrency(total)}</button>}
        </div>
      </div>
    </>
  )
}


