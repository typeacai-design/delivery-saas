'use client'

import { Check, Clock, Home, MapPin, MessageCircle, MessageSquareText, Pencil, Percent, Printer, Star, Trash2, Truck, Wallet, X } from 'lucide-react'
import { formatCurrency, formatarCodigoPedido } from '@/lib/utils'
import { flavorLabel, parseComplements } from '@/lib/flavor-pricing'
import { savedItemTotal } from '@/lib/product-pricing'
import { formatarFormaPagamentoDisplay } from '@/lib/whatsapp/template'
import type { Pedido } from '@/types'

type Props = {
  pedido: Pedido; items?: any[]; statusLabel: string; nextLabel?: string
  onAdvance: () => void; onEdit: () => void; onPaid: () => void; onWhatsApp: () => void
  onPrint: () => void; onDiscount: () => void; onCancel: () => void; onDelete: () => void
  onDetails: () => void; onReview: () => void; children?: React.ReactNode
}
export default function MerchantOrderCard({ pedido, items, statusLabel, nextLabel, onAdvance, onEdit, onPaid, onWhatsApp, onPrint, onDiscount, onCancel, onDelete, onDetails, onReview, children }: Props) {
  const order = pedido as Pedido & Record<string, any>
  const pickup = order.tipo_entrega === 'retirada'
  const isTable = order.tipo_pedido === 'mesa' || order.tipo_pedido === 'consolidado'
  const modality = isTable ? 'Mesa' : pickup ? 'Retirada' : 'Delivery'
  const ModalityIcon = pickup || isTable ? Home : Truck
  return <article className="wd-mobile-order" aria-label={`Pedido ${order.codigo || order.id}`}>
    <header className="wd-mo-header"><strong>{formatarCodigoPedido(order.id, order.data_criacao, order.codigo)}</strong><span className="wd-mo-status" data-status={order.status}>{statusLabel}</span></header>
    <div className="wd-mo-tags"><span className="wd-mo-modality"><ModalityIcon size={14} aria-hidden="true" />{modality}</span><span><Clock size={14} aria-hidden="true" /><time dateTime={order.data_criacao}>{new Date(order.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></span></div>
    <p className="wd-mo-customer">{order.cliente_nome || 'Cliente'}</p>
    {order.cliente_whatsapp && <p className="wd-mo-phone">{order.cliente_whatsapp}</p>}
    <section className="wd-mo-products" aria-label="Produtos e complementos"><div className="wd-mo-section-title">ITENS DO PEDIDO<span>{items?.reduce((sum, item) => sum + (Number(item.quantidade) || 1), 0) ?? '…'} unidades</span></div>
      {!items ? <p role="status">Carregando itens...</p> : items.length === 0 ? <p>Nenhum item encontrado.</p> : items.map((item, index) => {
        const complements = parseComplements(item.complementos)
        return <div className="wd-mo-product" key={item.id || index}><div className="wd-mo-product-head"><b className="wd-mo-qty">{item.quantidade || 1}×</b><strong>{item.nome}{item.variante_nome && <small>{item.variante_nome}</small>}</strong></div>
          {complements.length > 0 && <div className="wd-mo-complements"><p>Complementos</p><ul>{complements.map((complement: any, i: number) => <li key={i}><b>{complement.tipo === 'sabor' ? '' : `+ ${complement.quantidade || 1}×`}</b><span>{complement.tipo === 'sabor' ? flavorLabel(complement) : complement.nome}</span></li>)}</ul></div>}
          <span className="wd-mo-item-price">{formatCurrency(savedItemTotal(item))}</span>
        </div>
      })}
    </section>
    <section className="wd-mo-info" aria-label="Pagamento, endereço e observações">
      <div className="wd-mo-info-block"><span className="wd-mo-info-icon"><Wallet size={18} aria-hidden="true" /></span><div><h3>FORMA DE PAGAMENTO</h3><strong>{formatarFormaPagamentoDisplay(order.forma_pagamento)}</strong>{Number(order.troco_para) > 0 && <p>Troco para {formatCurrency(Number(order.troco_para))}</p>}<span className="wd-mo-paid" data-paid={Boolean(order.pago)}>{order.pago ? 'Pago' : 'Pagamento pendente'}</span></div></div>
      <div className="wd-mo-info-block"><span className="wd-mo-info-icon"><MapPin size={18} aria-hidden="true" /></span><div><h3>{isTable ? 'ATENDIMENTO' : pickup ? 'RETIRADA' : 'ENDEREÇO DE ENTREGA'}</h3><strong>{isTable ? 'Pedido de mesa' : pickup ? 'Retirada no balcão' : order.endereco_entrega ? `${order.endereco_entrega}${order.numero_entrega ? `, ${order.numero_entrega}` : ''}` : 'Endereço não informado'}</strong>{!pickup && !isTable && <>{order.bairro_entrega && <p>{order.bairro_entrega}</p>}{order.complemento_entrega && <p>{order.complemento_entrega}</p>}</>}</div></div>
      <div className="wd-mo-info-block"><span className="wd-mo-info-icon"><MessageSquareText size={18} aria-hidden="true" /></span><div><h3>OBSERVAÇÕES</h3><strong className="wd-mo-observation">{order.observacoes || 'Sem observações.'}</strong></div></div>
      {order.status === 'cancelado' && <div className="wd-mo-cancel-reason"><h3>Motivo do cancelamento</h3><p>{order.motivo_cancelamento?.replace(/_/g, ' ') || 'Não informado'}{order.motivo_cancelamento_detalhe ? ` — ${order.motivo_cancelamento_detalhe}` : ''}</p></div>}
    </section>
    {children}
    <div className="wd-mo-totals">{order.taxa_entrega > 0 && <div><span>Entrega</span><span>{formatCurrency(order.taxa_entrega)}</span></div>}{Number(order.valor_desconto) > 0 && <div><span>Desconto</span><span>− {formatCurrency(Number(order.valor_desconto))}</span></div>}{order.cupom_aplicado && <div><span>Cupom</span><span>{order.cupom_aplicado}</span></div>}<div className="wd-mo-total"><span>Total do pedido</span><strong>{formatCurrency(order.valor_total)}</strong></div></div>
    {nextLabel && <button type="button" className="wd-mo-advance" onClick={onAdvance}><Check size={18} aria-hidden="true" />{order.status === 'novo' ? 'Aceitar pedido' : `Avançar para ${nextLabel}`}</button>}
    <div className="wd-mo-actions"><button type="button" className="wd-mo-edit" onClick={onEdit}><Pencil size={16} aria-hidden="true" />Editar pedido</button><button type="button" onClick={onPaid} aria-pressed={Boolean(order.pago)}><Check size={16} aria-hidden="true" />{order.pago ? 'Pago' : 'Marcar pago'}</button><button type="button" onClick={onWhatsApp}><MessageCircle size={16} aria-hidden="true" />WhatsApp</button><button type="button" onClick={onPrint}><Printer size={16} aria-hidden="true" />Imprimir</button><button type="button" onClick={onDiscount}><Percent size={16} aria-hidden="true" />Desconto</button>{order.status === 'cancelado' ? <button type="button" className="wd-mo-danger" onClick={onDelete}><Trash2 size={16} aria-hidden="true" />Apagar</button> : <button type="button" className="wd-mo-danger" onClick={onCancel}><X size={16} aria-hidden="true" />{order.status === 'novo' ? 'Rejeitar' : 'Cancelar'}</button>}</div>
    <button type="button" className="wd-mo-details" onClick={onDetails}>Ver detalhes e entregador</button>
    {order.status === 'entregue' && <button type="button" className="wd-mo-details" onClick={onReview}><Star size={16} aria-hidden="true" />Copiar link de avaliação</button>}
  </article>
}
