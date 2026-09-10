'use client'

import { useEffect, useState } from 'react'

/**
 * Detecta se o dispositivo é mobile baseado no tamanho real da janela.
 * Garante que o layout funcione mesmo em navegadores in-app (WhatsApp, Instagram)
 * que podem ter comportamento inconsistente com media queries CSS.
 */
export function useIsMobile(breakpoint: number = 1024): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < breakpoint)
    }
    check()
    window.addEventListener('resize', check)
    // Também escuta mudanças de orientação
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [breakpoint])

  return isMobile
}
