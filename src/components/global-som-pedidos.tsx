'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Volume2, VolumeX, Bell } from 'lucide-react'

export default function GlobalSomPedidos({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [somAtivado, setSomAtivado] = useState(true)
  const [showNotif, setShowNotif] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')
  const [pedidosNovos, setPedidosNovos] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Inicializar audio
  useEffect(() => {
    audioRef.current = new Audio('/sounds/pedido-novo.mp3')
    audioRef.current.volume = 0.7
    audioRef.current.loop = true // Loop ate confirmar

    // Habilitar audio na primeira interacao
    const initAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause()
          if (audioRef.current) audioRef.current.currentTime = 0
        }).catch(() => {})
      }
      document.removeEventListener('click', initAudio)
    }
    document.addEventListener('click', initAudio, { once: true })

    return () => {
      document.removeEventListener('click', initAudio)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [])

  // Listener GLOBAL de novos pedidos via Supabase Realtime
  // Funciona em QUALQUER rota do dashboard
  useEffect(() => {
    let channel: any = null

    const setupRealtime = async () => {
      const supabase = createClient()
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Buscar tenant_id do usuario
      const { data: tenant } = await supabase
        .from('usuarios_loja')
        .select('tenant_id')
        .eq('user_id', user.user.id)
        .eq('ativo', true)
        .single()

      if (!tenant) return

      channel = supabase
        .channel('global-pedidos-som')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'pedidos',
            filter: `tenant_id=eq.${tenant.tenant_id}`,
          },
          (payload) => {
            const novo = payload.new as any
            // Tocar som
            if (somAtivado && audioRef.current) {
              audioRef.current.currentTime = 0
              audioRef.current.play().catch(() => {})
            }

            // Mostrar notificacao visual
            const codigo = novo.codigo || `#${novo.id.slice(0, 8)}`
            setNotifMsg(`Novo pedido! ${codigo}`)
            setShowNotif(true)
            setPedidosNovos(prev => prev + 1)

            // Vibrar
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              (navigator as any).vibrate([200, 100, 200])
            }

            // Auto-hide notificacao
            setTimeout(() => setShowNotif(false), 5000)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pedidos',
            filter: `tenant_id=eq.${tenant.tenant_id}`,
          },
          (payload) => {
            const updated = payload.new as any
            // Se saiu do status "novo", parar o som
            if (updated.status !== 'novo' && audioRef.current) {
              audioRef.current.pause()
              audioRef.current.currentTime = 0
              setPedidosNovos(0)
            }
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) {
        const supabase = createClient()
        supabase.removeChannel(channel)
      }
    }
  }, [somAtivado])

  // Parar som quando usuario sai da pagina de pedidos
  const toggleSom = () => {
    setSomAtivado(!somAtivado)
    if (somAtivado && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const irParaPedidos = () => {
    router.push('/pedidos')
  }

  return (
    <>
      {children}

      {/* Botao flutuante de som - SEMPRE visivel */}
      <button
        onClick={toggleSom}
        className={`fixed bottom-20 right-6 z-50 size-12 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 ${
          somAtivado ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
        }`}
        title={somAtivado ? 'Som ativado - clique para silenciar' : 'Som silenciado - clique para ativar'}
      >
        {somAtivado ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      {/* Notificacao de novo pedido - clickavel */}
      {showNotif && (
        <button
          onClick={irParaPedidos}
          className="fixed top-6 right-6 z-50 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-pulse hover:scale-105 transition-transform"
        >
          <Bell size={24} className="animate-bounce" />
          <div className="text-left">
            <p className="font-bold text-sm">{notifMsg}</p>
            <p className="text-xs opacity-90">Clique para ver →</p>
          </div>
        </button>
      )}
    </>
  )
}
