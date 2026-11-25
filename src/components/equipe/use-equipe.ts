'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type EstadoNotificacao = 'carregando' | 'sem_suporte' | 'instalar_iphone' | 'bloqueado' | 'desligado' | 'ativo'

const chaveVapid = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const base64ParaBytes = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded); const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

/** Notificações push do aparelho (funciona com o site em segundo plano; no iPhone, só instalado na tela inicial). */
export function useNotificacoes() {
  const [estado, setEstado] = useState<EstadoNotificacao>('carregando')

  const sincronizar = useCallback(async (pedirPermissao: boolean) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !chaveVapid()) {
      setEstado(ehIphone() && !instalado() ? 'instalar_iphone' : 'sem_suporte'); return
    }
    const registro = await navigator.serviceWorker.register('/sw-equipe.js', { scope: '/acesso' })
    await navigator.serviceWorker.ready
    if (Notification.permission === 'denied') { setEstado('bloqueado'); return }
    if (Notification.permission !== 'granted') {
      if (!pedirPermissao) { setEstado('desligado'); return }
      const resposta = await Notification.requestPermission()
      if (resposta !== 'granted') { setEstado(resposta === 'denied' ? 'bloqueado' : 'desligado'); return }
    }
    const inscricao = await registro.pushManager.getSubscription()
      || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chaveVapid()) })
    const r = await fetch('/api/equipe-app/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inscricao.toJSON()) })
    setEstado(r.ok ? 'ativo' : 'desligado')
  }, [])

  useEffect(() => { const t = window.setTimeout(() => { sincronizar(false).catch(() => setEstado('sem_suporte')) }, 0); return () => window.clearTimeout(t) }, [sincronizar])
  const ativar = useCallback(() => sincronizar(true).catch(() => setEstado('desligado')), [sincronizar])
  return { estado, ativar }
}

/**
 * Mantém a tela da equipe atualizada: aviso em tempo real da loja (só id e etapa do pedido),
 * aviso vindo da notificação push e uma conferência a cada 20s / ao voltar para a aba.
 */
export function useAtualizacao(tenantId: string | null, recarregar: () => void) {
  const ref = useRef(recarregar)
  useEffect(() => { ref.current = recarregar }, [recarregar])
  useEffect(() => {
    if (!tenantId) return
    const disparar = () => ref.current()
    const supabase = createClient()
    const canal = supabase.channel(`equipe:${tenantId}`).on('broadcast', { event: 'pedido' }, disparar).subscribe()
    const aoVoltar = () => { if (document.visibilityState === 'visible') disparar() }
    const aoMensagem = (e: MessageEvent) => { if (e.data?.tipo === 'wd-push') disparar() }
    const timer = window.setInterval(disparar, 20000)
    document.addEventListener('visibilitychange', aoVoltar)
    navigator.serviceWorker?.addEventListener('message', aoMensagem)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
      navigator.serviceWorker?.removeEventListener('message', aoMensagem)
      void supabase.removeChannel(canal)
    }
  }, [tenantId])
}

/** Som de alerta (pedido novo, prato pronto, entrega). Só toca depois do primeiro toque na tela. */
export function useSom() {
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    audio.current = new Audio('/sounds/pedido-novo.mp3')
    const destravar = () => { audio.current?.play().then(() => { audio.current?.pause(); if (audio.current) audio.current.currentTime = 0 }).catch(() => {}) }
    document.addEventListener('pointerdown', destravar, { once: true })
    return () => document.removeEventListener('pointerdown', destravar)
  }, [])
  return useCallback(() => { const a = audio.current; if (!a) return; a.currentTime = 0; void a.play().catch(() => {}) }, [])
}
