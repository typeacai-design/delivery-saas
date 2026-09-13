'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  }
  return context
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
}

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', icon: '#16A34A' },
  error: { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', icon: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', icon: '#D97706' },
  info: { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', icon: '#3B82F6' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((newToast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const duration = newToast.duration ?? 4000

    setToasts(prev => [...prev, { ...newToast, id }])

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  const ctx: ToastContextValue = {
    toast,
    success: (title, description) => toast({ type: 'success', title, description }),
    error: (title, description) => toast({ type: 'error', title, description, duration: 6000 }),
    info: (title, description) => toast({ type: 'info', title, description }),
    warning: (title, description) => toast({ type: 'warning', title, description }),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Container de toasts */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
          maxWidth: 'calc(100vw - 32px)',
          width: 380,
        }}
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          const colors = COLORS[t.type]
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                pointerEvents: 'auto',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                animation: 'toast-slide-in 0.25s ease-out',
              }}
            >
              <Icon size={20} style={{ color: colors.icon, flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: colors.text }}>{t.title}</div>
                {t.description && (
                  <div style={{ fontSize: 13, color: colors.text, opacity: 0.85, marginTop: 2 }}>
                    {t.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                aria-label="Fechar"
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 4,
                  cursor: 'pointer',
                  color: colors.text,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
          )
        })}

        <style jsx>{`
          @keyframes toast-slide-in {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
    </ToastContext.Provider>
  )
}
