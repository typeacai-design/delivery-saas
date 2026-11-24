'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, Printer, X } from 'lucide-react'

export type MesaQr = { id: string; numero: number; nome?: string | null; qr_token: string }

export const urlMesa = (slug: string, mesa: Pick<MesaQr, 'qr_token'>) =>
  `${window.location.origin}/cardapio/${encodeURIComponent(slug)}?mesa=${encodeURIComponent(mesa.qr_token)}`

const tituloMesa = (mesa: MesaQr) => mesa.nome?.trim() ? `${mesa.nome} (Mesa ${mesa.numero})` : `Mesa ${mesa.numero}`
const qrDataUrl = (url: string) => QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

/** Opens a print-ready page with one QR card per table (also used for a single table). */
export async function imprimirQrMesas(slug: string, lojaNome: string, mesas: MesaQr[]) {
  const janela = window.open('', '_blank')
  if (!janela) return false
  const cards = await Promise.all(mesas.map(async mesa => {
    const img = await qrDataUrl(urlMesa(slug, mesa))
    return `<section class="card"><p class="loja">${escapeHtml(lojaNome)}</p><h2>${escapeHtml(tituloMesa(mesa))}</h2><img src="${img}" alt="QR Code da ${escapeHtml(tituloMesa(mesa))}"/><p class="dica">Aponte a câmera do celular para ver o cardápio e pedir</p></section>`
  }))
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR Codes das mesas</title><style>
    *{box-sizing:border-box}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px;color:#17251c}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    .card{border:2px dashed #b9c7bd;border-radius:16px;padding:18px;text-align:center;break-inside:avoid;page-break-inside:avoid}
    .loja{margin:0;font-size:14px;color:#5d7063}h2{margin:6px 0 8px;font-size:28px}img{width:100%;max-width:280px}
    .dica{margin:6px 0 0;font-size:13px;color:#5d7063}@media print{body{padding:0}}
  </style></head><body><div class="grid">${cards.join('')}</div><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`)
  janela.document.close()
  return true
}

export default function MesaQrModal({ mesa, slug, lojaNome, onClose }: { mesa: MesaQr; slug: string; lojaNome: string; onClose: () => void }) {
  const [imagem, setImagem] = useState('')
  const [copiado, setCopiado] = useState(false)
  const url = urlMesa(slug, mesa)
  useEffect(() => {
    let ativo = true
    qrDataUrl(url).then(src => { if (ativo) setImagem(src) }).catch(() => {})
    return () => { ativo = false }
  }, [url])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* noop */ }
  }

  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={`QR Code da ${tituloMesa(mesa)}`} className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{tituloMesa(mesa)}</h3>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="flex justify-center">{imagem ? <img src={imagem} alt={`QR Code da ${tituloMesa(mesa)}`} className="w-64 h-64" /> : <div className="w-64 h-64 rounded-xl bg-gray-100 animate-pulse" />}</div>
      <p className="text-xs text-gray-500 break-all text-center">{url}</p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={copiar} className="btn-ghost justify-center text-xs"><Copy size={14} />{copiado ? 'Copiado' : 'Copiar'}</button>
        <a href={imagem || undefined} download={`qr-mesa-${mesa.numero}.png`} className="btn-ghost justify-center text-xs" aria-disabled={!imagem}><Download size={14} />Baixar</a>
        <button type="button" onClick={() => imprimirQrMesas(slug, lojaNome, [mesa])} className="btn-primary justify-center text-xs"><Printer size={14} />Imprimir</button>
      </div>
    </div>
  </div>
}
