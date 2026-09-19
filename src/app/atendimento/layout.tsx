'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface MembroEquipe {
  id: string
  nome: string
  username: string
  tenant_id: string
  perfil: 'attendant' | 'cozinha' | 'motoboy'
}

export default function AtendimentoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const verificarAcesso = () => {
      const membroStr = localStorage.getItem('membro_equipe')

      if (!membroStr) {
        router.replace('/acesso')
        return
      }

      try {
        const membro: MembroEquipe = JSON.parse(membroStr)

        // Apenas funcionários com perfil 'attendant' podem acessar
        if (membro.perfil !== 'attendant') {
          if (membro.perfil === 'cozinha') {
            router.replace('/acesso/cozinha')
          } else if (membro.perfil === 'motoboy') {
            router.replace('/acesso/motoboy')
          } else {
            router.replace('/acesso')
          }
          return
        }

        setAutorizado(true)
      } catch {
        localStorage.removeItem('membro_equipe')
        router.replace('/acesso')
        return
      }

      setCarregando(false)
    }

    verificarAcesso()
  }, [router])

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--green)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--ink-muted)]">Verificando acesso...</p>
        </div>
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-sm text-[var(--ink-muted)]">Redirecionando...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
