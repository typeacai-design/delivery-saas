'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Volume2, VolumeX, Bell } from 'lucide-react'

export default function GlobalSomPedidos({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [somAtivado, setSomAtivado] = useState(true)
  const [showNotif, setShowNotif] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const channelRef = useRef<any>(null)
  const initAudioDone = useRef(false)

  // Inicializar audio
  useEffect(() => {
    // Criar elemento de audio
    audioRef.current = new Audio('/sounds/pedido-novo.mp3')
    audioRef.current.volume = 0.7

    // Habilitar audio na primeira interacao do usuario (browser policy)
    const initAudio = () => {
      if (audioRef.current && !initAudioDone.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause()
          if (audioRef.current) audioRef.current.currentTime = 0
          initAudioDone.current = true
          console.log('[Som] Audio inicializado com sucesso')
        }).catch((err) => {
          console.log('[Som] Audio nao pode ser iniciado automaticamente:', err.message)
        })
      }
      document.removeEventListener('click', initAudio)
      document.removeEventListener('touchstart', initAudio)
    }

    document.addEventListener('click', initAudio, { once: true })
    document.addEventListener('touchstart', initAudio, { once: true })

    return () => {
      document.removeEventListener('click', initAudio)
      document.removeEventListener('touchstart', initAudio)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [])

  // Listener GLOBAL de novos pedidos via Supabase Realtime
  useEffect(() => {
    let mounted = true

    const setupRealtime = async () => {
      try {
        const supabase = createClient()

        // Verificar autenticacao
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          console.error('[Som] Erro de autenticacao:', authError)
          return
        }
        if (!user) {
          console.log('[Som] Usuario nao autenticado')
          return
        }

        // Buscar tenant_id do usuario
        const { data: tenant, error: tenantError } = await supabase
          .from('usuarios_loja')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .single()

        if (tenantError) {
          console.error('[Som] Erro ao buscar tenant:', tenantError)
          return
        }
        if (!tenant) {
          console.log('[Som] Nenhum tenant encontrado para este usuario')
          return
        }

        console.log('[Som] Configurando Realtime para tenant:', tenant.tenant_id)

        // Criar canal de realtime
        const channelName = `global-pedidos-som-${tenant.tenant_id}`

        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
        }

        channelRef.current = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'pedidos',
              filter: `tenant_id=eq.${tenant.tenant_id}`,
            },
            (payload) => {
              if (!mounted) return
              const novo = payload.new as any
              console.log('[Som] Novo pedido detectado:', novo.id)

              // Tocar som
              if (somAtivado && audioRef.current) {
                audioRef.current.currentTime = 0
                audioRef.current.play().catch((err) => {
                  console.log('[Som] Erro ao tocar audio:', err.message)
                })
              }

              // Mostrar notificacao visual
              const codigo = novo.codigo || `#${novo.id?.slice(0, 8) || 'novo'}`
              setNotifMsg(`Novo pedido! ${codigo}`)
              setShowNotif(true)

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
              if (!mounted) return
              const updated = payload.new as any
              console.log('[Som] Pedido atualizado:', updated.id, 'status:', updated.status)

              // Se saiu do status "novo", parar o som
              if (updated.status !== 'novo' && audioRef.current) {
                audioRef.current.pause()
                audioRef.current.currentTime = 0
              }
            }
          )
          .subscribe((status: string) => {
            console.log('[Som] Status do canal:', status)
          })

      } catch (err) {
        console.error('[Som] Erro ao configurar Realtime:', err)
      }
    }

    setupRealtime()

    return () => {
      mounted = false
      if (channelRef.current) {
        const supabase = createClient()
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [somAtivado])

  const toggleSom = useCallback(() => {
    setSomAtivado((prev) => {
      const novo = !prev
      if (!novo && audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      return novo
    })
  }, [])

  const irParaPedidos = () => {
    router.push('/pedidos')
    setShowNotif(false)
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
