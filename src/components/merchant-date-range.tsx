'use client'

import { useId, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export type OrderDateRange = { from: string; to: string }
const parseDay = (value: string) => new Date(value + 'T12:00:00')
const shortDay = (value: string) => parseDay(value).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
export function formatOrderDateRange({ from, to }: OrderDateRange) {
  if (!from && !to) return 'Selecionar período'
  if (!from) return `Até ${shortDay(to)} ${to.slice(0, 4)}`
  if (!to) return `A partir de ${shortDay(from)} ${from.slice(0, 4)}`
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${shortDay(from)} — ${shortDay(to)} ${to.slice(0, 4)}`
    : `${shortDay(from)} ${from.slice(0, 4)} — ${shortDay(to)} ${to.slice(0, 4)}`
}
export function chooseOrderRange(draft: OrderDateRange, day: string): OrderDateRange {
  if (!draft.from || draft.to) return { from: day, to: '' }
  return day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day }
}

export default function MerchantDateRange({ from, to, onApply }: OrderDateRange & { onApply: (range: OrderDateRange) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<OrderDateRange>({ from: '', to: '' })
  const [month, setMonth] = useState(() => {
    const date = from || to ? parseDay(from || to) : new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1, 12)
  })
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }
  const toggle = () => {
    if (open) { close(); return }
    const date = from || to ? parseDay(from || to) : new Date()
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12))
    setDraft({ from: '', to: '' }); setOpen(true)
  }
  const year = month.getFullYear(), monthIndex = month.getMonth()
  const firstWeekday = new Date(year, monthIndex, 1, 12).getDay()
  const days = new Date(year, monthIndex + 1, 0, 12).getDate()
  return <section className="wd-period-filter" aria-label="Filtro de datas" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close() } }}>
    <button type="button" ref={trigger} className="wd-period-trigger" onClick={toggle} aria-expanded={open} aria-controls={panelId}>
      <CalendarDays size={20} aria-hidden="true" /><span><small>Período</small><strong>{formatOrderDateRange({ from, to })}</strong></span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <section id={panelId} className="wd-period-calendar" aria-label="Escolher período no calendário">
      <div className="wd-period-month"><button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(year, monthIndex - 1, 1, 12))}><ChevronLeft size={18} /></button><strong>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Próximo mês" onClick={() => setMonth(new Date(year, monthIndex + 1, 1, 12))}><ChevronRight size={18} /></button></div>
      <p className="wd-period-instruction" aria-live="polite">{!draft.from ? 'Toque na data inicial' : !draft.to ? `${shortDay(draft.from)} · Agora toque na data final` : `${shortDay(draft.from)} — ${shortDay(draft.to)}`}</p>
      <div className="wd-period-week" aria-hidden="true">{['D','S','T','Q','Q','S','S'].map((day, index) => <span key={index}>{day}</span>)}</div>
      <div className="wd-period-days">{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => {
        const day = index + 1
        const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const selected = date === draft.from || date === draft.to
        return <button type="button" key={date} aria-pressed={selected} data-between={Boolean(draft.from && draft.to && date > draft.from && date < draft.to)} aria-label={parseDay(date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} onClick={() => setDraft(previous => chooseOrderRange(previous, date))}>{day}</button>
      })}</div>
      <div className="wd-period-actions"><button type="button" onClick={close}>Cancelar</button><button type="button" className="wd-period-apply" disabled={!draft.from || !draft.to} onClick={() => { if (!draft.from || !draft.to) return; onApply(draft); close() }}>Aplicar período</button></div>
    </section>}
  </section>
}
