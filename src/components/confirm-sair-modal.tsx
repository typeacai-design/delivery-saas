'use client'

import { LogOut, X } from 'lucide-react'
import { useEffect } from 'react'

type ConfirmSairModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  nome?: string
}

export function ConfirmSairModal({ open, onClose, onConfirm, nome }: ConfirmSairModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sair-title"
    >
      <div
        className="glass w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ border: '1px solid rgba(255,255,255,.6)' }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div
            className="size-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,.15), rgba(239,68,68,.05))',
              border: '1px solid rgba(239,68,68,.25)',
            }}
          >
            <LogOut size={20} style={{ color: '#DC2626' }} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="size-8 rounded-xl flex items-center justify-center hover:bg-black/5 transition"
            style={{ color: 'var(--ink-faint)' }}
          >
            <X size={16} />
          </button>
        </div>

        <h3
          id="confirm-sair-title"
          className="font-display text-lg font-semibold mb-1.5"
          style={{ color: 'var(--ink)' }}
        >
          Sair do atendimento?
        </h3>
        <p className="hint mb-5">
          {nome ? `${nome}, você` : 'Você'} vai precisar do usuário e da senha de acesso pra entrar de novo.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-medium border transition hover:bg-white/80"
            style={{
              background: 'rgba(255,255,255,.6)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #DC2626, #EF4444)',
              boxShadow: '0 8px 22px -10px rgba(220,38,38,.55)',
            }}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
