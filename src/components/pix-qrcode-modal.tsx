'use client'

import { useState } from 'react'
import { X, Copy, Check, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PixModalProps {
  onClose: () => void
  valor: number
  brCode: string
  qrCodeBase64: string
  txid: string
  expiracao: string
}

export function PixQrCodeModal({ onClose, valor, brCode, qrCodeBase64, txid, expiracao }: PixModalProps) {
  const [copied, setCopied] = useState(false)

  function copiarCodigo() {
    navigator.clipboard.writeText(brCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Pagar via PIX</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={20} />
            </button>
          </div>

          <div className="text-center mb-4">
            <p className="text-3xl font-bold text-green-600">{formatCurrency(valor)}</p>
            <p className="text-sm text-gray-600 mt-1">Mensalidade We Delivery</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white border-2 rounded-2xl">
              <img src={qrCodeBase64} alt="QR Code PIX" className="w-64 h-64" />
            </div>
          </div>

          {/* Linha digitável */}
          <div className="mb-4">
            <p className="text-xs text-gray-600 mb-2">Ou copie o código PIX:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={brCode}
                readOnly
                className="flex-1 px-3 py-2 border rounded-xl text-xs font-mono"
              />
              <button onClick={copiarCodigo} className="btn-primary px-4">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* TXID */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Identificador (TXID):</span>
              <span className="font-mono">{txid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Expira em:</span>
              <span>{new Date(expiracao).toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800">
              <strong>Importante:</strong> Após o pagamento, envie o comprovante para o admin pelo WhatsApp. A confirmação é manual e pode levar até 24h.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
