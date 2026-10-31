'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Volume2, VolumeX } from 'lucide-react'
import { useMerchantMobile } from '@/lib/use-merchant-mobile'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { OrderAlertTracker, type AlertOrder } from '@/lib/order-alert-tracker'

const OrderSoundContext = createContext({ somAtivado: true, alternarSom: () => {} })
export const useOrderSound = () => useContext(OrderSoundContext)

export default function GlobalSomPedidos({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)
  const [somAtivado, setSomAtivado] = useState(true)
  const mobile = useMerchantMobile()
  const enabledRef = useRef(true)
  const syncRef = useRef<() => void>(() => {})
  useEffect(() => { enabledRef.current = mobile || somAtivado; syncRef.current() }, [mobile, somAtivado])
  useEffect(() => {
    let disposed = false, channel: ReturnType<ReturnType<typeof createClient>['channel']> | undefined
    let tenantId: string | null = null
    let polling = false, context: AudioContext | undefined, buffer: AudioBuffer | undefined
    let source: AudioBufferSourceNode | undefined, decoding: Promise<void> | undefined
    const controller = new AbortController(), tracker = new OrderAlertTracker(), supabase = createClient()
    const queued: { order: AlertOrder; isArrival: boolean }[] = []
    const bytes = fetch('/sounds/pedido-novo.mp3', { signal: controller.signal })
      .then(response => response.ok ? response.arrayBuffer() : undefined).catch(() => undefined)
    const stop = () => { if (source) { source.stop(); source.disconnect(); source = undefined } }
    const sync = () => {
      if (disposed) return
      setPendingCount(tracker.pending.size)
      if (!tracker.pending.size || !enabledRef.current) { stop(); return }
      if (!context || context.state !== 'running' || !buffer || source) return
      source = context.createBufferSource(); source.buffer = buffer; source.loop = true
      const gain = context.createGain(); gain.gain.value = 0.7
      source.connect(gain); gain.connect(context.destination); source.start()
      source.onended = () => gain.disconnect()
    }
    syncRef.current = sync
    // User gestures unlock a silent audio context. No order sound is played as a test.
    const unlock = () => {
      if (disposed) return
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      if (!context) context = new AudioContextClass()
      void context.resume().then(sync).catch(() => {})
      if (!decoding) decoding = bytes.then(async data => {
        if (!disposed && data && context) buffer = await context.decodeAudioData(data)
        sync()
      }).catch(() => {})
    }
    const receive = (order: AlertOrder, isArrival = true) => {
      if (disposed) return
      if (!tracker.initialized) { queued.push({ order, isArrival }); return }
      tracker.receive(order, isArrival); sync()
    }
    const snapshot = async () => {
      if (polling || disposed || !tenantId) return
      polling = true
      try {
        const response = await fetch('/api/pedidos/list', { cache: 'no-store', signal: controller.signal })
        const result = await response.json()
        if (disposed || !response.ok || !result.ok || result.tenantId !== tenantId) return
        const initial = !tracker.initialized
        tracker.snapshot(result.pedidos || [])
        for (const { order, isArrival } of queued.splice(0)) {
          if (initial && isArrival && order.status === 'novo' && !order.deleted_at) tracker.pending.add(order.id)
          tracker.receive(order, isArrival)
        }
        sync()
        const listed = new Set((result.pedidos || []).map((order: AlertOrder) => order.id))
        const missing = [...tracker.pending].filter(id => !listed.has(id))
        if (missing.length) {
          const { data } = await supabase.from('pedidos').select('id,status,deleted_at').eq('tenant_id', tenantId).in('id', missing)
          if (!disposed) { for (const order of data || []) tracker.receive(order, false); sync() }
        }
      } catch { /* Retry on the next poll/reconnection; keep Realtime active. */ }
      finally { polling = false }
    }
    const setup = async () => {
      tenantId = await activeTenantId()
      if (disposed || !tenantId) return
      channel = supabase.channel(`merchant-order-alerts-${tenantId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${tenantId}` }, payload => receive(payload.new as AlertOrder))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${tenantId}` }, payload => receive(payload.new as AlertOrder, false))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pedidos' }, payload => { tracker.remove((payload.old as AlertOrder).id); sync() })
        .subscribe(status => { if (status === 'SUBSCRIBED') void snapshot() })
      void snapshot()
    }
    const onUpdated = (event: Event) => { const order = (event as CustomEvent<AlertOrder>).detail; if (order?.id) receive(order, false) }
    const onVisible = () => { if (document.visibilityState === 'visible') { void snapshot(); unlock() } }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('touchstart', unlock, { passive: true })
    document.addEventListener('keydown', unlock)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', snapshot)
    window.addEventListener('wd:order-updated', onUpdated)
    const timer = window.setInterval(snapshot, 30000)
    void setup().catch(() => {})
    return () => {
      disposed = true; controller.abort(); clearInterval(timer); stop()
      if (channel) void supabase.removeChannel(channel)
      if (context) void context.close().catch(() => {})
      document.removeEventListener('pointerdown', unlock); document.removeEventListener('touchstart', unlock)
      document.removeEventListener('keydown', unlock); document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', snapshot); window.removeEventListener('wd:order-updated', onUpdated)
    }
  }, [])
  const alternarSom = () => setSomAtivado(value => !value)
  return <OrderSoundContext.Provider value={{ somAtivado, alternarSom }}>{children}
    <button type="button" onClick={alternarSom} className={`hidden md:flex wd-desktop-sound-toggle fixed bottom-20 right-6 z-50 size-12 rounded-full shadow-2xl items-center justify-center transition-all hover:scale-110 ${somAtivado ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`} title={somAtivado ? 'Som ativado - clique para silenciar' : 'Som silenciado - clique para ativar'}>{somAtivado ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
    {pendingCount > 0 && <button type="button" className="wd-new-order-notification" onClick={() => router.push('/pedidos')}>
    <Bell size={22} aria-hidden="true" /><span><strong>{pendingCount === 1 ? 'Novo pedido!' : `${pendingCount} novos pedidos!`}</strong><small>Toque para atender</small></span>
  </button>}</OrderSoundContext.Provider>
}
