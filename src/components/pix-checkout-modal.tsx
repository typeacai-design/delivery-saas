'use client'

import { useState } from 'react'
import { X, Copy, Check, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PixCheckoutModalProps {
  onClose: () => void
  valor: number
  brCode: string
  qrCodeBase64: string
  txid: string
}

export function PixCheckoutModal({ onClose, valor, brCode, qrCodeBase64, txid }: PixCheckoutModalProps) {
  const [copied, setCopied] = useState(false)

  function copiarCodigo() {
    navigator.clipboard.writeText(brCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="glass p-6 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>Pagar com PIX</h2>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full">
              <X size={20} />
            </button>
          </div>

          <div className="text-center mb-4">
            <p className="text-3xl font-bold" style={{ color: 'var(--green)' }}>{formatCurrency(valor)}</p>
            <p className="hint text-sm mt-1">Escaneie o QR Code ou copie o código abaixo</p>
          </div>

          {qrCodeBase64 ? (
            <div className="bg-white p-4 rounded-2xl flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeBase64} alt="QR Code PIX" className="size-56" />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <Loader2 className="animate-spin" size={32} style={{ color: 'var(--green)' }} />
            </div>
          )}

          <div>
            <label>PIX Copia e Cola</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={brCode}
                className="flex-1 text-xs font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button onClick={copiarCodigo} className="btn-primary" style={{ padding: '0.5rem 0.85rem' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <p className="hint text-xs mt-4 text-center">
            Após pagar, clique em "Já paguei" e o lojista vai ser notificado.
          </p>

          <button
            onClick={onClose}
            className="btn-ghost w-full justify-center mt-3"
          >
            Já paguei
          </button>

          <p className="hint text-xs mt-2 text-center">Pedido #{txid?.slice(-8)}</p>
        </div>
      </div>
    </>
  )
}
