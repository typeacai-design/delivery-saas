'use client'

import { useEffect, useRef, useState } from 'react'

type Detector = { detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorConstrutor = new (opcoes: { formats: string[] }) => Detector

/**
 * Lê um QR Code pela câmera traseira usando o leitor nativo do navegador (Chrome no Android).
 * Chama onLido com o texto do QR assim que encontra um.
 */
export default function LeitorQr({ onLido, onFechar }: { onLido: (texto: string) => void; onFechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState('')
  const lidoRef = useRef(onLido)
  useEffect(() => { lidoRef.current = onLido }, [onLido])

  useEffect(() => {
    let ativo = true
    let stream: MediaStream | null = null
    let timer: number | undefined
    const Construtor = (window as unknown as { BarcodeDetector?: DetectorConstrutor }).BarcodeDetector
    const iniciar = async () => {
      if (!Construtor) { setErro('Este navegador não lê QR Code. Use o Chrome no Android ou digite o número da mesa.'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      } catch {
        setErro('Não foi possível abrir a câmera. Libere a câmera para este site nas configurações do navegador.'); return
      }
      if (!ativo || !video.current) { stream.getTracks().forEach(t => t.stop()); return }
      video.current.srcObject = stream
      await video.current.play().catch(() => {})
      const detector = new Construtor({ formats: ['qr_code'] })
      const procurar = async () => {
        if (!ativo || !video.current) return
        try {
          const [achado] = await detector.detect(video.current)
          if (achado?.rawValue) { ativo = false; lidoRef.current(achado.rawValue); return }
        } catch { /* quadro sem leitura: tenta de novo */ }
        timer = window.setTimeout(procurar, 250)
      }
      void procurar()
    }
    void iniciar()
    return () => { ativo = false; window.clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  return <div className="wd-eq-modal" onClick={onFechar}><div role="dialog" aria-modal="true" aria-label="Escanear QR Code da mesa" onClick={e => e.stopPropagation()}>
    <strong style={{ fontSize: 18 }}>Escanear QR da mesa</strong>
    {erro ? <p className="wd-equipe-erro" role="alert" style={{ margin: 0 }}>{erro}</p> : <>
      <video ref={video} muted playsInline style={{ width: '100%', borderRadius: 14, background: '#000', aspectRatio: '1 / 1', objectFit: 'cover' }} />
      <p style={{ margin: 0, fontSize: 13, color: '#5d7063', textAlign: 'center' }}>Aponte a câmera para o QR Code colado na mesa</p>
    </>}
    <button type="button" className="wd-eq-botao-sec" onClick={onFechar}>Fechar</button>
  </div></div>
}
