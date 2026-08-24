'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { Copy, ShoppingCart, Check, ArrowUpRight, TrendingUp, Calendar, Power, PowerOff } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function VisaoGeralPage() {
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const [loading, setLoading] = useState(true)
  const [totalHoje, setTotalHoje] = useState(0)
  const [totalMes, setTotalMes] = useState(0)
  const [pedidosHoje, setPedidosHoje] = useState(0)
  const [pedidosMes, setPedidosMes] = useState(0)
  const [slug, setSlug] = useState('')
  const [copied, setCopied] = useState(false)
  const [lojaAberta, setLojaAberta] = useState(true)
  const [toggleLoading, setToggleLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const tenantId = await activeTenantId()
      if (!tenantId) { setLoading(false); return }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug, config')
        .eq('id', tenantId)
        .single()
      if (tenant) {
        setSlug(tenant.slug)
        setLojaAberta((tenant.config as any)?.loja_aberta ?? true)
      }

      const hoje = new Date().toISOString().split('T')[0]
      const primeiroDia = new Date()
      primeiroDia.setDate(1)
      primeiroDia.setHours(0, 0, 0, 0)

      const { data: vendasHojeRaw } = await supabase
        .from('pedidos')
        .select('valor_total, pago, status, forma_pagamento')
        .eq('tenant_id', tenantId)
        .gte('data_criacao', hoje)
        .neq('status', 'cancelado')

      // Faturamento: pago=true OU (entregue E dinheiro)
      const vendasHoje = (vendasHojeRaw || []).filter(p =>
        p.pago === true || (p.status === 'entregue' && p.forma_pagamento === 'dinheiro')
      )
      setTotalHoje(vendasHoje.reduce((s, p) => s + Number(p.valor_total), 0))
      setPedidosHoje(vendasHoje.length)

      const { data: vendasMesRaw } = await supabase
        .from('pedidos')
        .select('valor_total, pago, status, forma_pagamento')
        .eq('tenant_id', tenantId)
        .gte('data_criacao', primeiroDia.toISOString())
        .neq('status', 'cancelado')

      const vendasMes = (vendasMesRaw || []).filter(p =>
        p.pago === true || (p.status === 'entregue' && p.forma_pagamento === 'dinheiro')
      )
      setTotalMes(vendasMes.reduce((s, p) => s + Number(p.valor_total), 0))
      setPedidosMes(vendasMes.length)
    } catch (err) {
      console.error('Erro loadData:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleLoja = async () => {
    setToggleLoading(true)
    try {
      const tenantId = await activeTenantId()
      if (!tenantId) { setToggleLoading(false); return }

      const novoStatus = !lojaAberta
      const { data: tenant } = await supabase
        .from('tenants')
        .select('config')
        .eq('id', tenantId)
        .single()

      const config = (tenant?.config || {}) as any
      config.loja_aberta = novoStatus

      await supabase
        .from('tenants')
        .update({ config })
        .eq('id', tenantId)

      setLojaAberta(novoStatus)
    } catch (err) {
      console.error('Erro toggle:', err)
    } finally {
      setToggleLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8 hint">Carregando...</div>

  return (
    <div>
      {/* Hero iridescente + botão loja */}
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Visão geral</div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
              {saudacao}, <span className="gradient-text">chefe!</span>
            </h1>
            <p className="hint mt-2 max-w-md">
              Aqui está o resumo das vendas de hoje e do mês.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold" style={{
              background: lojaAberta ? 'rgba(22,163,74,.14)' : 'rgba(220,38,38,.10)',
              color: lojaAberta ? '#15803D' : '#B91C1C',
              border: '1px solid currentColor',
            }}>
              <span className="size-2 rounded-full" style={{ background: lojaAberta ? '#16A34A' : '#DC2626' }} />
              {lojaAberta ? 'Loja aberta' : 'Loja fechada'}
            </span>
            <button
              onClick={toggleLoja}
              disabled={toggleLoading}
              className={lojaAberta ? 'btn-secondary' : 'btn-primary'}
              style={lojaAberta ? {
                background: '#DC2626',
                borderColor: 'rgba(255,255,255,.2)',
                boxShadow: '0 6px 16px -6px rgba(220,38,38,.5)',
              } : undefined}
            >
              {lojaAberta ? <PowerOff size={14} /> : <Power size={14} />}
              {lojaAberta ? 'Fechar loja' : 'Abrir loja'}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="glass p-7 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20" style={{ background: 'var(--green)', filter: 'blur(50px)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,.14)' }}>
                <TrendingUp size={18} style={{ color: '#15803D' }} strokeWidth={2.5} />
              </div>
              <span className="eyebrow">Vendas hoje</span>
            </div>
            <div className="text-5xl font-semibold gradient-text tabular-nums mb-2">
              {formatCurrency(totalHoje)}
            </div>
            <div className="hint">{pedidosHoje} pedido{pedidosHoje !== 1 && 's'} hoje</div>
          </div>
        </div>

        <div className="glass p-7 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20" style={{ background: 'var(--ink)', filter: 'blur(50px)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,.06)' }}>
                <Calendar size={18} style={{ color: '#0A0A0A' }} strokeWidth={2.5} />
              </div>
              <span className="eyebrow">Faturamento do mês</span>
            </div>
            <div className="text-5xl font-semibold tabular-nums mb-2" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totalMes)}
            </div>
            <div className="hint">{pedidosMes} pedido{pedidosMes !== 1 && 's'} no mês</div>
          </div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={copyLink}
          className="glass p-6 flex items-center gap-4 hover:bg-white/95 transition group text-left"
        >
          <div className="size-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--green)' }}>
            {copied ? <Check size={24} className="text-white" strokeWidth={2.5} /> : <Copy size={24} className="text-white" strokeWidth={2.5} />}
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
              {copied ? 'Link copiado!' : 'Copiar link do cardápio'}
            </div>
            <div className="hint font-mono">/{slug}</div>
          </div>
          {!copied && <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--ink-faint)' }} />}
        </button>

        <a
          href="/pedidos/novo"
          className="glass p-6 flex items-center gap-4 hover:bg-white/95 transition group"
        >
          <div className="size-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--ink)' }}>
            <ShoppingCart size={24} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
              Lançar pedido manual
            </div>
            <div className="hint">Crie um pedido no balcão</div>
          </div>
          <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--ink-faint)' }} />
        </a>
      </div>
    </div>
  )
}

