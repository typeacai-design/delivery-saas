'use client'
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatarCodigoPedido } from '@/lib/utils'
import type { Pedido } from '@/types'
export default function MerchantHistoryOrder({ pedido, statusLabel, children }: { pedido: Pedido; statusLabel: string; children: ReactNode }) {
 const [open,setOpen]=useState(false)
 return <div className="wd-history-order"><button type="button" className="wd-history-summary" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
  <span className="wd-history-line"><strong>{formatarCodigoPedido(pedido.id,pedido.data_criacao,pedido.codigo)}</strong><span className="wd-mo-status" data-status={pedido.status}>{statusLabel}</span><ChevronDown size={18} aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined}} /></span>
  <b>{pedido.cliente_nome || 'Cliente'}</b><time dateTime={pedido.data_criacao}>{new Date(pedido.data_criacao).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})} · {new Date(pedido.data_criacao).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})}</time>
 </button>{open?children:null}</div>
}
