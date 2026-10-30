'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** Collapsible on mobile; the complete existing form remains mounted inside. */
export default function MerchantDisclosure({ title, count, children, className = '', initiallyOpen = false }: {
  title: string; count?: string; children: ReactNode; className?: string; initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const element = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)')
    const sync = () => setOpen(!element.current?.closest('.wd-merchant') || desktop.matches || initiallyOpen)
    sync()
    desktop.addEventListener('change', sync)
    return () => desktop.removeEventListener('change', sync)
  }, [initiallyOpen])
  return <details ref={element} className={'wd-disclosure ' + className} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><strong>{title}</strong>{count && <small>{count}</small>}</span><ChevronDown size={18} aria-hidden="true" /></summary>
    <div className="wd-disclosure-body">{children}</div>
  </details>
}
