'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { Copy, ShoppingCart, Check, ArrowUpRight, TrendingUp, Calendar, Power } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// Função para verificar se a loja está aberta baseado no horário configurado
function verificarLojaAbertaPorHorario(horarios: any): boolean {
  if (!horarios) return true
  const agora = new Date()
  const diaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][agora.getDay()]
  const diaConfig = horarios[diaSemana]
  if (!diaConfig || !diaConfig.ativo) return false
  const horaAtual = agora.getHours() * 60 + agora.getMinutes()
  const [hAbre, mAbre] = (diaConfig.abre || '00:00').split(':').map(Number)
  const [hFecha, mFecha] = (diaConfig.fecha || '23:59').split(':').map(Number)
  const horaAbre = hAbre * 60 + mAbre
  const horaFecha = hFecha * 60 + mFecha
  return horaAtual >= horaAbre && horaAtual <= horaFecha
}

// Função para obter mensagem do horário
function getHorarioMsg(horarios: any): string {
  if (!horarios) return ''
  const agora = new Date()
  const diaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][agora.getDay()]
  const diaConfig = horarios[diaSemana]
  if (!diaConfig) return ''
  if (!diaConfig.ativo) return `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)} - Fechado`
  return `${diaConfig.abre} - ${diaConfig.fecha}`
}

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
  const [lojaAberta, setLojaAberta] = useState<boolean | null>(null) // null = seguir horário
  const [horarios, setHorarios] = useState<any>(null)
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
        const config = (tenant.config as any) || {}
        const horariosDias = config.horarios_dias || null
        setHorarios(horariosDias)

        // Calcula se está dentro do horário ATUALMENTE (não usa estado, usa a variável local)
        const horarioAtual = horariosDias ? verificarLojaAbertaPorHorario(horariosDias) : true

        // Lê override manual do banco (se existir)
        const overrideManual = config.loja_aberta
        if (overrideManual !== undefined && overrideManual !== null) {
          // Verifica se o override ainda é válido (dentro do horário atual)
          if (overrideManual === horarioAtual) {
            setLojaAberta(overrideManual)
          } else {
            // Override expirou - remove do banco e segue horário
            const newConfig = { ...config }
            delete newConfig.loja_aberta
            await supabase.from('tenants').update({ config: newConfig }).eq('id', tenantId)
            setLojaAberta(null)
          }
        } else {
          setLojaAberta(null)
        }
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

  // Verificar se está aberto por horário (para exibição sutil)
  const abertoPorHorario = horarios ? verificarLojaAbertaPorHorario(horarios) : true
  const horarioMsg = horarios ? getHorarioMsg(horarios) : ''

  // Status final: lojaAberta indica override manual (true/false) ou null = seguir horário
  // Quando dentro do horário → abre automático, SEM botão
  // Quando fora do horário → mostra status + botão discreto "Abrir agora"

  const copyLink = async () => {
    const url = `${window.location.origin}/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const abrirAgora = async () => {
    setToggleLoading(true)
    try {
      const tenantId = await activeTenantId()
      if (!tenantId) { setToggleLoading(false); return }

      // Salva override manual no banco
      await supabase
        .from('tenants')
        .update({
          config: { ...((await supabase.from('tenants').select('config').eq('id', tenantId).single()).data?.config || {}), loja_aberta: true }
        })
        .eq('id', tenantId)

      setLojaAberta(true)
    } catch (err) {
      console.error('Erro abrir:', err)
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
            {/* Status da loja - visual sutil */}
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: abertoPorHorario ? '#16A34A' : '#DC2626' }}
              />
              <span style={{ color: abertoPorHorario ? '#15803D' : '#B91C1C' }}>
                {abertoPorHorario ? 'Aberto' : 'Fechado'}
              </span>
              {horarioMsg && (
                <span className="text-gray-400">· {horarioMsg}</span>
              )}
            </div>

            {/* Botão Abrir agora - SÓ aparece quando FORA do horário */}
            {!abertoPorHorario && (
              <button
                onClick={abrirAgora}
                disabled={toggleLoading}
                className="px-2 py-1 text-xs rounded-lg transition flex items-center gap-1 bg-green-100 text-green-700 hover:bg-green-200"
                title="Abrir agora (válido até horário de fechar)"
              >
                {toggleLoading ? (
                  <span className="w-3 h-3 border border-green-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Power size={10} />
                    <span className="hidden sm:inline">Abrir agora</span>
                  </>
                )}
              </button>
            )}
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
