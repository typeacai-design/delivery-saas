'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, Bell } from 'lucide-react'

interface SomContextType {
  somAtivado: boolean
  toggleSom: () => void
  notificar: (mensagem?: string) => void
}

const SomContext = createContext<SomContextType>({
  somAtivado: true,
  toggleSom: () => {},
  notificar: () => {},
})

export function useSom() {
  return useContext(SomContext)
}

// Provider que fica SEMPRE montado, independente da rota
export default function SomProvider({ children }: { children: React.ReactNode }) {
  const [somAtivado, setSomAtivado] = useState(true)
  const [showNotificacao, setShowNotificacao] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Inicializa audio uma vez
    audioRef.current = new Audio('/sounds/pedido-novo.mp3')
    audioRef.current.volume = 0.7

    // Tentar tocar audio na primeira interacao do usuario (autoplay policy)
    const initAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause()
          audioRef.current!.currentTime = 0
        }).catch(() => {})
      }
      document.removeEventListener('click', initAudio)
      document.removeEventListener('keydown', initAudio)
    }
    document.addEventListener('click', initAudio, { once: true })
    document.addEventListener('keydown', initAudio, { once: true })

    return () => {
      document.removeEventListener('click', initAudio)
      document.removeEventListener('keydown', initAudio)
    }
  }, [])

  const toggleSom = () => {
    setSomAtivado(!somAtivado)
  }

  const notificar = (mensagem = 'Novo pedido!') => {
    setNotifMsg(mensagem)
    setShowNotificacao(true)

    // Tocar som
    if (somAtivado && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }

    // Vibrar (mobile)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      (navigator as any).vibrate([200, 100, 200])
    }

    // Auto-hide apos 5 segundos
    setTimeout(() => setShowNotificacao(false), 5000)
  }

  return (
    <SomContext.Provider value={{ somAtivado, toggleSom, notificar }}>
      {children}

      {/* Botao flutuante para ligar/desligar som */}
      <button
        onClick={toggleSom}
        className={`fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 ${
          somAtivado ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
        }`}
        title={somAtivado ? 'Som ativado' : 'Som desligado'}
      >
        {somAtivado ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>

      {/* Notificacao visual */}
      {showNotificacao && (
        <div className="fixed top-6 right-6 z-50 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-pulse">
          <Bell size={24} />
          <div>
            <p className="font-bold">{notifMsg}</p>
            <p className="text-sm opacity-90">Clique para ver</p>
          </div>
        </div>
      )}
    </SomContext.Provider>
  )
}
