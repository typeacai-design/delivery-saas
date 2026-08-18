'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { CreditCard, Check, Clock, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PixQrCodeModal } from '@/components/pix-qrcode-modal'

type Mensalidade = {
  id: string
  competencia: string
  valor: number
  vencimento: string
  status: 'pago' | 'pendente' | 'vencido'
  pago_em: string | null
}

export default function MensalidadePage() {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([])
  const [loading, setLoading] = useState(true)
  const [pixModal, setPixModal] = useState<{ txid: string; valor: number; brCode: string; qrCodeBase64?: string } | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const tid = await activeTenantId()
      if (!tid) return

      // Garante mensalidades geradas pra esse tenant
      await fetch('/api/mensalidades/gerar', { method: 'POST' })

      const { data } = await supabase
        .from('mensalidades')
        .select('*')
        .eq('tenant_id', tid)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })

      // Mapear pro tipo da UI
      const mapped: Mensalidade[] = (data || []).map((m) => ({
        id: m.id,
        competencia: `${m.ano}-${String(m.mes).padStart(2, '0')}`,
        valor: Number(m.valor),
        vencimento: m.data_vencimento,
        status: m.status,
        pago_em: m.data_pagamento,
      }))
      setMensalidades(mapped)
    } catch (e) {
      console.error('Erro ao carregar mensalidades:', e)
    } finally {
      setLoading(false)
    }
  }

  const handlePagar = async (m: Mensalidade) => {
    if (m.status === 'pago') return
    try {
      const res = await fetch('/api/pix/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensalidade_id: m.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX')
      setPixModal({ txid: data.txid, valor: m.valor, brCode: data.br_code, qrCodeBase64: data.qr_code_base64 })
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar PIX')
    }
  }

  const formatMes = (comp: string) => {
    const [ano, mes] = comp.split('-')
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    return `${meses[parseInt(mes) - 1]} ${ano}`
  }
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

  const totalPago = mensalidades.filter(m => m.status === 'pago').reduce((s, m) => s + m.valor, 0)
  const totalAberto = mensalidades.filter(m => m.status !== 'pago').reduce((s, m) => s + m.valor, 0)

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto animate-spin mb-3" size={32} style={{ color: 'var(--green)' }} />
        <p className="hint">Carregando mensalidades...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2 flex items-center gap-1.5">
              <Sparkles size={11} />
              Financeiro
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
              Mensalidades
            </h1>
            <p className="hint mt-2">Histórico e pagamentos da sua assinatura</p>
          </div>
          <div className="flex gap-3">
            <div className="glass-soft px-4 py-2.5 text-center">
              <div className="hint text-xs">Pago</div>
              <div className="text-sm font-semibold gradient-text-teal">{formatCurrency(totalPago)}</div>
            </div>
            <div className="glass-soft px-4 py-2.5 text-center">
              <div className="hint text-xs">Em aberto</div>
              <div className="text-sm font-semibold" style={{ color: '#BE185D' }}>{formatCurrency(totalAberto)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass p-6">
        <div className="eyebrow mb-4">Histórico</div>
        <div className="flex flex-col gap-2">
          {mensalidades.map((m) => {
            const isPago = m.status === 'pago'
            const isVencido = m.status === 'vencido'

            return (
              <div
                key={m.id}
                className="glass-soft p-4 flex items-center gap-4"
                style={isVencido ? { background: 'rgba(239,68,68,.06)', borderColor: 'rgba(239,68,68,.25)' } : undefined}
              >
                <div
                  className="size-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: isPago ? 'rgba(16,185,129,.14)' : isVencido ? 'rgba(239,68,68,.14)' : 'rgba(245,158,11,.14)',
                  }}
                >
                  {isPago ? <Check size={18} style={{ color: '#047857' }} strokeWidth={2.5} /> :
                    isVencido ? <AlertTriangle size={18} style={{ color: '#B91C1C' }} strokeWidth={2.5} /> :
                      <Clock size={18} style={{ color: '#92400E' }} strokeWidth={2.5} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {formatMes(m.competencia)}
                    </div>
                    {isPago && <span className="chip chip--positive">Pago</span>}
                    {isVencido && <span className="chip chip--negative">Vencido</span>}
                    {!isPago && !isVencido && <span className="chip chip--warn">Pendente</span>}
                  </div>
                  <div className="hint text-xs">
                    Vencimento: {formatDate(m.vencimento)}
                    {isPago && m.pago_em && ` • Pago em ${formatDate(m.pago_em)}`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-semibold tabular-nums mb-2" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(m.valor)}
                  </div>
                  {!isPago && (
                    <button
                      onClick={() => handlePagar(m)}
                      className="btn-primary text-xs"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
                    >
                      <CreditCard size={12} />
                      Pagar com PIX
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {mensalidades.length === 0 && (
          <div className="text-center py-8 hint">
            Nenhuma mensalidade registrada
          </div>
        )}
      </div>

      {pixModal && (
        <PixQrCodeModal
          onClose={() => setPixModal(null)}
          valor={pixModal.valor}
          brCode={pixModal.brCode}
          qrCodeBase64={pixModal.qrCodeBase64 || ''}
          txid={pixModal.txid}
          expiracao={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
        />
      )}
    </div>
  )
}
