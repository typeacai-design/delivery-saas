'use client'

import { useState } from 'react'
import { X, ChevronRight, Copy, MessageCircle, Star, MapPin, Home, Truck, Plus, Save } from 'lucide-react'
import { formatCurrency, formatarCodigoPedido, formatDateFull, formatarFormaPagamentoDisplay } from '@/lib/utils'
import { parseComplements, savedItemTotal } from '@/lib/product-pricing'
import { PedidoStatus } from '@/types'

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; bgColor: string }> = {
  novo: { label: 'Novo', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  preparando: { label: 'Preparando', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  pronto: { label: 'Pronto', color: 'text-green-700', bgColor: 'bg-green-100' },
  saiu: { label: 'Saiu', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  entregue: { label: 'Entregue', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  cancelado: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100' },
}

const NEXT_STATUS: Record<PedidoStatus, PedidoStatus | null> = {
  novo: 'preparando',
  preparando: 'pronto',
  pronto: 'saiu',
  saiu: 'entregue',
  entregue: null,
  cancelado: null,
}

// ============ MODAL DE DETALHES ============
interface PedidoDetalhesModalProps {
  pedido: any
  itens: any[]
  motoboys: any[]
  tenantNome: string
  onClose: () => void
  onUpdateStatus: (pedido: any, newStatus: PedidoStatus) => void
  onAtribuirMotoboy: (pedidoId: string, motoboyId: string) => void
  onGerarConviteAvaliacao: (pedidoId: string) => void
  onToastError: (msg: string, desc?: string) => void
}

export function PedidoDetalhesModal({
  pedido, itens, motoboys, tenantNome, onClose, onUpdateStatus, onAtribuirMotoboy,
  onGerarConviteAvaliacao, onToastError
}: PedidoDetalhesModalProps) {
  const [gerandoAvaliacao, setGerandoAvaliacao] = useState(false)

  const handleEnviarAvaliacao = async () => {
    setGerandoAvaliacao(true)
    try {
      const response = await fetch(`/api/pedidos/${encodeURIComponent(pedido.id)}/avaliacao-convite`, { method: 'POST' })
      const body = await response.json()
      if (!response.ok) return onToastError(body.error || 'Erro ao gerar convite')

      const link = `${window.location.origin}/avaliar/${body.token}`
      const fone = (pedido.cliente_whatsapp || '').replace(/\D/g, '')

      const { gerarMensagemAvaliacao } = await import('@/lib/whatsapp/template')
      const msg = gerarMensagemAvaliacao({
        tenantNome: tenantNome || 'Nossa Loja',
        codigo: pedido.codigo || pedido.id.slice(0, 8),
        linkAvaliacao: link
      })

      window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank')
    } catch {
      onToastError('Erro ao enviar avaliação')
    } finally {
      setGerandoAvaliacao(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">Pedido {formatarCodigoPedido(pedido.id, pedido.data_criacao, pedido.codigo)}</h2>
              <p className="text-gray-500">{formatDateFull(pedido.data_criacao)}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${STATUS_CONFIG[pedido.status].bgColor} ${STATUS_CONFIG[pedido.status].color}`}>
            {STATUS_CONFIG[pedido.status].label}
          </span>

          {pedido.status === 'cancelado' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Motivo do cancelamento:</p>
              <p className="text-sm text-red-900">
                {pedido.motivo_cancelamento
                  ? pedido.motivo_cancelamento.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                  : 'Não informado'}
              </p>
              {pedido.motivo_cancelamento_detalhe && (
                <p className="text-sm text-red-800 italic mt-2 border-l-2 border-red-300 pl-2">
                  "{pedido.motivo_cancelamento_detalhe}"
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Cliente */}
          <div>
            <h3 className="font-medium mb-2">👤 Cliente</h3>
            <p className="text-gray-900 font-medium">{pedido.cliente_nome || 'Não identificado'}</p>
            {pedido.cliente_whatsapp && <p className="text-gray-600">📱 {pedido.cliente_whatsapp}</p>}
          </div>

          {/* Itens */}
          <div>
            <h3 className="font-medium mb-3">📋 Itens do Pedido</h3>
            <div className="space-y-2">
              {itens.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.quantidade}x {item.nome}
                    {item.variante_nome && <span className="text-gray-500"> ({item.variante_nome})</span>}
                    {item.complementos && item.complementos.length > 0 && (
                      <span className="text-gray-500"> + {parseComplements(item.complementos).map((c: any) => c.nome).join(', ')}</span>
                    )}
                  </span>
                  <span className="font-medium">{formatCurrency(savedItemTotal(item))}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totais */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(pedido.valor_subtotal || (pedido.valor_total - (pedido.taxa_entrega || 0)))}</span>
            </div>
            {pedido.taxa_entrega > 0 && (
              <div className="flex justify-between text-sm">
                <span>Taxa de entrega</span>
                <span>{formatCurrency(pedido.taxa_entrega)}</span>
              </div>
            )}
            {pedido.valor_desconto > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto</span>
                <span>-{formatCurrency(pedido.valor_desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="text-green-600">{formatCurrency(pedido.valor_total)}</span>
            </div>
          </div>

          {/* Pagamento */}
          <div>
            <h3 className="font-medium mb-2">💳 Pagamento</h3>
            <p className="text-sm text-gray-600">
              {formatarFormaPagamentoDisplay(pedido.forma_pagamento)}
              {pedido.troco_para > 0 && <span> • Troco para: {formatCurrency(pedido.troco_para)}</span>}
            </p>
          </div>

          {/* Entrega */}
          <div>
            <h3 className="font-medium mb-2">🚚 {pedido.tipo_entrega === 'retirada' ? 'Retirada' : 'Entrega'}</h3>
            {pedido.tipo_entrega === 'retirada' ? (
              <p className="text-sm text-gray-600">Cliente vai retirar no local</p>
            ) : (
              <p className="text-sm text-gray-600">
                {pedido.endereco_entrega || '-'}{pedido.numero_entrega ? `, ${pedido.numero_entrega}` : ''}
                {pedido.bairro_entrega ? ` - ${pedido.bairro_entrega}` : ''}
                {pedido.complemento_entrega ? ` (${pedido.complemento_entrega})` : ''}
              </p>
            )}
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <div>
              <h3 className="font-medium mb-2">📝 Observações</h3>
              <p className="text-sm text-gray-600">{pedido.observacoes}</p>
            </div>
          )}

          {/* Cupom */}
          {pedido.cupom_aplicado && (
            <div>
              <h3 className="font-medium mb-2">🎟️ Cupom</h3>
              <p className="text-sm text-green-600 font-medium">{pedido.cupom_aplicado}</p>
            </div>
          )}

          {/* Motoboy */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">🛵 Entregador</h3>
            <select
              className="form-input w-full"
              value={pedido.motoboy_id || ''}
              onChange={e => onAtribuirMotoboy(pedido.id, e.target.value)}
            >
              <option value="">Selecionar entregador...</option>
              {motoboys.map(m => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.tipo_comissao === 'fixa' ? `R$ ${Number(m.comissao_fixa).toFixed(2)}` : `${Number(m.comissao_percent).toFixed(1)}%`})
                </option>
              ))}
            </select>
            {pedido.motoboy_comissao != null && (
              <p className="text-sm text-gray-500 mt-1">
                Comissão registrada: {formatCurrency(Number(pedido.motoboy_comissao))}
              </p>
            )}
          </div>

          {/* Avaliação */}
          {pedido.status === 'entregue' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Avaliação do Cliente
              </h3>
              <p className="text-sm text-green-700 mb-3">
                Envie um convite para o cliente avaliar sua experiência
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="flex-1 px-3 py-2 bg-white border border-green-300 text-green-700 text-sm rounded-lg hover:bg-green-100 flex items-center justify-center gap-2"
                  onClick={() => onGerarConviteAvaliacao(pedido.id)}
                >
                  <Copy className="w-4 h-4" />
                  Copiar link
                </button>
                {pedido.cliente_whatsapp && (
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    onClick={handleEnviarAvaliacao}
                    disabled={gerandoAvaliacao}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {gerandoAvaliacao ? 'Gerando...' : 'Enviar via WhatsApp'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="border-t pt-4 flex flex-wrap gap-2">
            {NEXT_STATUS[pedido.status] && (
              <button
                onClick={() => { onUpdateStatus(pedido, NEXT_STATUS[pedido.status]!) }}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
              >
                {STATUS_CONFIG[NEXT_STATUS[pedido.status]!].label}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && NEXT_STATUS[pedido.status] && (
              <button
                onClick={() => {
                  if (!confirm('Cancelar este pedido?')) return
                  onUpdateStatus(pedido, 'cancelado')
                }}
                className="px-3 py-2 text-red-600 border border-red-200 hover:bg-red-50 text-sm rounded-lg flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            )}

            {pedido.cliente_whatsapp && (
              <a
                href={`https://wa.me/${pedido.cliente_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${pedido.cliente_nome || ''}! Sobre seu pedido ${pedido.codigo || ''}...`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL DE DESCONTO ============
interface PedidoDescontoModalProps {
  pedido: any
  onClose: () => void
  onAplicar: () => void
  tipoDesconto: 'valor' | 'percentual'
  valorDesconto: string
  onTipoChange: (t: 'valor' | 'percentual') => void
  onValorChange: (v: string) => void
}

export function PedidoDescontoModal({
  pedido, onClose, onAplicar, tipoDesconto, valorDesconto, onTipoChange, onValorChange
}: PedidoDescontoModalProps) {
  const valor = parseFloat(valorDesconto) || 0
  const desconto = tipoDesconto === 'valor'
    ? valor
    : (pedido.valor_subtotal || pedido.valor_total) * (valor / 100)
  const novoTotal = Math.max(0, (pedido.valor_total + (pedido.valor_desconto || 0)) - desconto)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Aplicar Desconto</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          Pedido: <strong>{pedido.codigo || '#' + pedido.id.slice(0, 8)}</strong>
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Subtotal atual: <strong>{formatCurrency(pedido.valor_subtotal || pedido.valor_total)}</strong>
        </p>

        {/* Tipo */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Tipo de desconto</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onTipoChange('valor')}
              className={`p-3 rounded-xl border-2 font-medium transition ${
                tipoDesconto === 'valor' ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              Valor (R$)
            </button>
            <button
              onClick={() => onTipoChange('percentual')}
              className={`p-3 rounded-xl border-2 font-medium transition ${
                tipoDesconto === 'percentual' ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              Percentual (%)
            </button>
          </div>
        </div>

        {/* Valor */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {tipoDesconto === 'valor' ? 'Valor do desconto (R$)' : 'Percentual de desconto (%)'}
          </label>
          <input
            type="number"
            step={tipoDesconto === 'valor' ? '0.01' : '0.1'}
            value={valorDesconto}
            onChange={(e) => onValorChange(e.target.value)}
            placeholder={tipoDesconto === 'valor' ? '0,00' : '0'}
            className="form-input w-full text-xl"
            autoFocus
          />
        </div>

        {/* Preview */}
        <div className="mb-4 p-4 bg-green-50 rounded-xl">
          <div className="flex justify-between text-sm mb-1">
            <span>Desconto:</span>
            <span className="font-bold text-red-600">-{formatCurrency(desconto)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Novo total:</span>
            <span className="text-green-600">{formatCurrency(novoTotal)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button onClick={onAplicar} className="btn-primary flex-1 justify-center">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL DE CANCELAMENTO ============
interface PedidoCancelarModalProps {
  pedido: any
  onClose: () => void
  onConfirmar: () => void
  motivoSelecionado: string
  motivoDetalhe: string
  onMotivoChange: (m: string) => void
  onDetalheChange: (d: string) => void
  salvando: boolean
}

const MOTIVOS = [
  { id: 'cliente_desistiu', label: 'Cliente desistiu do pedido' },
  { id: 'nao_conseguimos_atender', label: 'Não conseguimos atender' },
  { id: 'fora_area_entrega', label: 'Fora da área de entrega' },
  { id: 'cliente_nao_respondeu', label: 'Cliente não respondeu' },
  { id: 'pagamento_recusado', label: 'Pagamento recusado' },
  { id: 'produto_indisponivel', label: 'Produto indisponível' },
  { id: 'erro_pedido', label: 'Erro no pedido (lojista)' },
  { id: 'outro', label: 'Outro motivo' },
]

export function PedidoCancelarModal({
  pedido, onClose, onConfirmar, motivoSelecionado, motivoDetalhe, onMotivoChange, onDetalheChange, salvando
}: PedidoCancelarModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        <div className="p-5 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-red-100 flex items-center justify-center">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-900">Cancelar pedido?</h2>
              <p className="text-sm text-red-700">
                {pedido.codigo || `#${pedido.id.slice(0, 8)}`} - {pedido.cliente_nome || 'Cliente'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              ⚠️ Tem certeza que deseja cancelar este pedido?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Esta ação não pode ser desfeita. O pedido não será mais processado.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Motivo do cancelamento *
            </label>
            <div className="space-y-2">
              {MOTIVOS.map((op) => (
                <label
                  key={op.id}
                  className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: motivoSelecionado === op.id ? 'var(--green)' : '#E5E7EB', background: motivoSelecionado === op.id ? 'rgba(22,163,74,.06)' : 'transparent' }}
                >
                  <input
                    type="radio"
                    name="motivo"
                    checked={motivoSelecionado === op.id}
                    onChange={() => onMotivoChange(op.id)}
                    className="size-4"
                  />
                  <span className="text-sm">{op.label}</span>
                </label>
              ))}
            </div>
          </div>

          {(motivoSelecionado === 'outro' || motivoSelecionado) && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Detalhes {motivoSelecionado === 'outro' ? '*' : '(opcional)'}
              </label>
              <textarea
                className="form-input w-full"
                rows={3}
                value={motivoDetalhe}
                onChange={(e) => onDetalheChange(e.target.value)}
                placeholder="Descreva o motivo do cancelamento..."
              />
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm" disabled={salvando}>
            Voltar
          </button>
          <button
            onClick={onConfirmar}
            disabled={salvando || !motivoSelecionado}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            {salvando ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ ITEM EDITOR ============
interface ItemEditorProps {
  item: any
  idx: number
  tenantId: string
  onChange: (idx: number, item: any) => void
  onRemove: (idx: number) => void
}

function ItemEditor({ item, idx, onChange, onRemove }: ItemEditorProps) {
  return (
    <div className="border rounded-lg p-3 space-y-2" style={{ borderColor: '#E4E8EE' }}>
      <div className="flex gap-2">
        <input
          className="form-input flex-1"
          placeholder="Nome do item"
          value={item.nome || ''}
          onChange={e => onChange(idx, { ...item, nome: e.target.value })}
        />
        <input
          type="number"
          className="form-input w-20"
          placeholder="Qtd"
          value={item.quantidade || 1}
          onChange={e => onChange(idx, { ...item, quantidade: Number(e.target.value) })}
        />
        <input
          type="number"
          step="0.01"
          className="form-input w-28"
          placeholder="Valor R$"
          value={item.valor_unitario || ''}
          onChange={e => onChange(idx, { ...item, valor_unitario: Number(e.target.value) })}
        />
        <button onClick={() => onRemove(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

// ============ MODAL DE EDIÇÃO ============
interface PedidoEditarModalProps {
  pedido: any
  itens: any[]
  onClose: () => void
  onSalvar: () => void
  onPedidoChange: (p: any) => void
  onItensChange: (i: any[]) => void
  salvando: boolean
}

export function PedidoEditarModal({
  pedido, itens, onClose, onSalvar, onPedidoChange, onItensChange, salvando
}: PedidoEditarModalProps) {
  const addItem = () => {
    onItensChange([...itens, { produto_id: '', nome: '', quantidade: 1, valor_unitario: 0, complementos: [] }])
  }

  const updateItem = (i: number, novo: any) => {
    const novos = [...itens]
    novos[i] = novo
    onItensChange(novos)
  }

  const removeItem = (i: number) => {
    onItensChange(itens.filter((_, ix) => ix !== i))
  }

  const subtotal = itens.reduce((acc, i) => {
    const compTotal = parseComplements(i.complementos).reduce((s: number, c: any) => s + (Number(c.valor) || 0) * (Number(c.quantidade) || 1), 0)
    return acc + ((Number(i.valor_unitario) || 0) + compTotal) * (Number(i.quantidade) || 1)
  }, 0)
  const taxa = Number(pedido.taxa_entrega) || 0
  const desconto = Number(pedido.valor_desconto) || 0
  const total = Math.max(0, subtotal + taxa - desconto)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <h2 className="text-xl font-bold">Editar pedido {pedido.codigo || pedido.id.slice(0, 8)}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Cliente */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">👤 Dados do Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="font-medium block mb-1">Nome</span>
                <input className="form-input w-full" value={pedido.cliente_nome || ''} onChange={e => onPedidoChange({ ...pedido, cliente_nome: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="font-medium block mb-1">WhatsApp</span>
                <input className="form-input w-full" value={pedido.cliente_whatsapp || ''} onChange={e => onPedidoChange({ ...pedido, cliente_whatsapp: e.target.value })} />
              </label>
            </div>
          </div>

          {/* Endereço */}
          <div className="bg-green-50 rounded-xl p-4">
            <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">📍 Endereço de Entrega</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm md:col-span-2">
                <span className="font-medium block mb-1">Endereço</span>
                <input className="form-input w-full" value={pedido.endereco_entrega || ''} onChange={e => onPedidoChange({ ...pedido, endereco_entrega: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="font-medium block mb-1">Número</span>
                <input className="form-input w-full" value={pedido.numero_entrega || ''} onChange={e => onPedidoChange({ ...pedido, numero_entrega: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="font-medium block mb-1">Bairro</span>
                <input className="form-input w-full" value={pedido.bairro_entrega || ''} onChange={e => onPedidoChange({ ...pedido, bairro_entrega: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="font-medium block mb-1">Complemento</span>
                <input className="form-input w-full" value={pedido.complemento_entrega || ''} onChange={e => onPedidoChange({ ...pedido, complemento_entrega: e.target.value })} />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="font-medium block mb-1">Observações</span>
                <textarea className="form-input w-full" rows={2} value={pedido.observacoes || ''} onChange={e => onPedidoChange({ ...pedido, observacoes: e.target.value })} />
              </label>
            </div>
          </div>

          {/* Valores */}
          <div className="bg-yellow-50 rounded-xl p-4">
            <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">💰 Valores</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="font-medium block mb-1">Taxa de entrega (R$)</span>
                <input type="number" step="0.01" className="form-input w-full" value={pedido.taxa_entrega || 0} onChange={e => onPedidoChange({ ...pedido, taxa_entrega: Number(e.target.value) })} />
              </label>
              <label className="text-sm">
                <span className="font-medium block mb-1">Desconto (R$)</span>
                <input type="number" step="0.01" className="form-input w-full" value={pedido.valor_desconto || 0} onChange={e => onPedidoChange({ ...pedido, valor_desconto: Number(e.target.value) })} />
              </label>
            </div>
          </div>

          {/* Itens */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Itens do pedido</h3>
              <button onClick={addItem} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, i) => (
                <ItemEditor key={i} item={item} idx={i} onChange={updateItem} onRemove={removeItem} />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
              {taxa > 0 && <div className="flex justify-between"><span>Taxa:</span><span>{formatCurrency(taxa)}</span></div>}
              {desconto > 0 && <div className="flex justify-between text-green-600"><span>Desconto:</span><span>-{formatCurrency(desconto)}</span></div>}
              <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>TOTAL:</span><span className="text-green-600">{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t sticky bottom-0 bg-white flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
          <button onClick={onSalvar} disabled={salvando} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
            <Save className="w-4 h-4" />
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
