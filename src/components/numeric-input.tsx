'use client'

import { useState, type InputHTMLAttributes } from 'react'

type NumericValue = number | string | null | undefined
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: NumericValue
  /** Receives null while the field is empty, so the caller decides the fallback. */
  onValueChange: (value: number | null) => void
}

const parse = (value: NumericValue) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
// Zero is shown as an empty field (placeholder) so it never gets stuck in front of what the user types.
const display = (value: NumericValue) => { const number = parse(value); return number === null || number === 0 ? '' : String(number) }

/**
 * Number field that can be emptied while typing. Plain controlled inputs bound to
 * `Number(e.target.value) || 0` re-render "0" as soon as the field is cleared, which
 * leaves a zero that cannot be erased (and turns "5" into "05").
 */
export default function NumericInput({ value, onValueChange, placeholder = '0', ...rest }: Props) {
  const [draft, setDraft] = useState(() => display(value))
  const [lastValue, setLastValue] = useState(value)
  if (!Object.is(lastValue, value)) {
    // Only resync when the parent changed the value on its own (load, reset, clamp).
    setLastValue(value)
    if ((parse(draft) ?? 0) !== (parse(value) ?? 0)) setDraft(display(value))
  }
  return <input {...rest} placeholder={placeholder} type="number" inputMode="decimal" value={draft} onChange={event => {
    const raw = event.target.value.replace(/^0+(?=\d)/, '')
    setDraft(raw)
    onValueChange(parse(raw))
  }} />
}
