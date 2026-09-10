'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Dialog reutilizável.
 * Overlay preto opaco (rgba(0,0,0,0.85)) + card branco sólido.
 * Padrão visual de referência: modal de sucesso do pedido manual
 * (src/app/(dashboard)/pedidos/novo/page.tsx:1678-1719).
 */
export function Dialog({ open, onClose, title, children, maxWidth = 'md' }: DialogProps) {
  // ESC fecha
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const widthClass =
    maxWidth === 'sm' ? 'max-w-sm' :
    maxWidth === 'md' ? 'max-w-md' :
    maxWidth === 'lg' ? 'max-w-lg' :
    'max-w-2xl'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className={`rounded-3xl p-6 w-full ${widthClass} shadow-2xl max-h-[90vh] overflow-y-auto`}
        style={{ background: '#FFFFFF' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="dialog-title" className="text-xl font-semibold" style={{ color: '#172033' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={18} style={{ color: '#697386' }} />
          </button>
        </div>
        <div className="text-gray-900">{children}</div>
      </div>
    </div>
  )
}
