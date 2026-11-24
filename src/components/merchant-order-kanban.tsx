'use client'

import { useState, type ReactNode } from 'react'

type KanbanOrder = { id: string; status: string }
type Column = { id: string; label: string }

/**
 * Desktop order flow as a kanban board. Dragging a card onto the next column is the same
 * as pressing the card's "advance" button: only the order's next stage accepts the drop.
 */
export default function MerchantOrderKanban<T extends KanbanOrder>({ columns, orders, renderCard, nextStatusOf, onMove }: {
  columns: Column[]
  orders: T[]
  renderCard: (order: T) => ReactNode
  nextStatusOf: (order: T) => string | null
  onMove: (order: T, status: string) => void
}) {
  const [dragging, setDragging] = useState<T | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const target = dragging ? nextStatusOf(dragging) : null
  const finish = () => { setDragging(null); setOver(null) }

  return <div className="wd-kanban" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(250px, 1fr))` }}>
    {columns.map(column => {
      const items = orders.filter(order => order.status === column.id)
      const accepts = target === column.id
      return <section
        key={column.id}
        className="wd-kanban-column"
        data-status={column.id}
        data-accepts={dragging ? String(accepts) : undefined}
        data-over={over === column.id ? 'true' : undefined}
        aria-label={`${column.label}: ${items.length} pedido(s)`}
        onDragOver={event => { if (!accepts) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (over !== column.id) setOver(column.id) }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(current => current === column.id ? null : current) }}
        onDrop={event => { event.preventDefault(); if (dragging && accepts) onMove(dragging, column.id); finish() }}
      >
        <header className="wd-kanban-header"><span>{column.label}</span><b>{items.length}</b></header>
        <div className="wd-kanban-cards">
          {items.length === 0 ? <p className="wd-kanban-empty">{accepts ? 'Solte aqui' : 'Nenhum pedido'}</p> : items.map(order =>
            <div
              key={order.id}
              className="wd-kanban-card"
              draggable={nextStatusOf(order) !== null}
              data-dragging={dragging?.id === order.id ? 'true' : undefined}
              onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', order.id); setDragging(order) }}
              onDragEnd={finish}
            >{renderCard(order)}</div>)}
        </div>
      </section>
    })}
  </div>
}
