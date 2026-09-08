'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import { Copy, ShoppingCart, Check, ArrowUpRight, TrendingUp, Calendar, Power } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// Função para verificar se a loja está aberta baseado no horário configurado (mesma lógica do cardápio público)
function verificarLojaAbertaPorHorario(config: any): { aberto: boolean; horarioMsg: string } {
  const horariosDias = config?.horarios_dias
  const horarioLegado = config?.horario || { abre: '08:00', fecha: '22:00' }

  // Se não há horários configurados, loja fica FECHADA
  if (!horariosDias || Object.keys(horariosDias).length === 0) {
    return { aberto: false, horarioMsg: '' }
  }

  // Usar timezone do Brasil
  const agora = new Date()
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaAtual = brasilia.getDay()
  const minutosAgora = brasilia.getHours() * 60 + brasilia.getMinutes()

  // Mapear dia da semana (0-6) para chave
  const DIAS_CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const chaveDia = DIAS_CHAVES[diaAtual]

  // Pegar horários do dia
  let horariosDia = horariosDias[chaveDia]

  // Se não encontrar pelo nome, tenta pelo índice numérico
  if (!horariosDia && Array.isArray(horariosDias)) {
    horariosDia = horariosDias.find((item: any) => Number(item.dia ?? item.dia_semana) === diaAtual)
  }

  // Parse do horário
  const parseTime = (s: any) => {
    if (!s) return null
    const parts = String(s).split(':').map(Number)
    return parts.length >= 2 ? parts[0] * 60 + parts[1] : null
  }

  const inicioMin = parseTime(horariosDia?.abre || horariosDia?.inicio) ?? parseTime(horarioLegado.abre) ?? 480
  const fimMin = parseTime(horariosDia?.fecha || horariosDia?.fim) ?? parseTime(horarioLegado.fecha) ?? 1320

  // Verificar se o dia está marcado como inativo
  const diaInativo = horariosDia?.ativo === false
  const dentroHorario = !diaInativo && minutosAgora >= inicioMin && minutosAgora <= fimMin

  // Mensagem do horário
  const abre = horariosDia?.abre || horariosDia?.inicio || horarioLegado.abre || '08:00'
  const fecha = horariosDia?.fecha || horariosDia?.fim || horarioLegado.fecha || '22:00'
  const horarioMsg = diaInativo ? `${chaveDia} - Fechado` : `${abre} - ${fecha}`

  return { aberto: dentroHorario, horarioMsg }
}

// ---------------------------------------------------------------------------
// Calcula o timestamp em que um override manual deve expirar.
//
// tipo === 'abrir'  -> loja foi aberta manualmente. Expira no proximo
//                       horario PROGRAMADO de fechamento (do dia atual
//                       se ainda nao fechou, senao do proximo dia ativo).
// tipo === 'fechar' -> loja foi fechada manualmente. Expira no proximo
//                       horario PROGRAMADO de abertura (hoje se ainda nao
//                       abriu, senao no proximo dia ativo).
//
// Retorna Date ou null se nenhum horario configurado.
// ---------------------------------------------------------------------------
function calcularExpiracaoOverride(
  horariosDias: any,
  tipo: 'abrir' | 'fechar'
): Date | null {
  if (!horariosDias || Object.keys(horariosDias).length === 0) return null

  const agora = new Date()
  // Minutos de hoje no fuso de Brasilia (mesmo criterio do verificarLojaAbertaPorHorario)
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaAtualIdx = brasilia.getDay()
  const minutosHoje = brasilia.getHours() * 60 + brasilia.getMinutes()

  const parseTime = (s: any): number | null => {
    if (!s) return null
    const parts = String(s).split(':').map(Number)
    return parts.length >= 2 ? parts[0] * 60 + parts[1] : null
  }

  const DIAS_CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

  // Tenta encontrar o slot do dia. Aceita formato {seg:{abre,fecha,ativo}} ou array.
  const slotDoDia = (diaIdx: number): any => {
    const chave = DIAS_CHAVES[diaIdx]
    const item = horariosDias[chave]
    if (item) return item
    if (Array.isArray(horariosDias)) {
      return horariosDias.find((x: any) => Number(x.dia ?? x.dia_semana) === diaIdx)
    }
    return null
  }

  // Calcula a diferenca em dias entre hoje (Brasilia) e o dia destino
  const diffDias = (diaDestinoIdx: number): number => {
    let diff = (diaDestinoIdx - diaAtualIdx + 7) % 7
    return diff
  }

  // Constrói um Date em Brasilia (UTC-3) para dia+hora especificados
  const diaParaTimestamp = (diaIdx: number, minutos: number): Date => {
    // Pega o inicio do dia de hoje em Brasilia
    const inicioHojeBrasilia = new Date(brasilia)
    inicioHojeBrasilia.setHours(0, 0, 0, 0)
    // Soma os dias (em horario local do servidor; servidor roda em UTC, mas
    // brasilia ja tem offset -3 embutido no .toLocaleString -- entao a hora
    // do servidor reflete a hora local de Brasilia).
    const target = new Date(inicioHojeBrasilia)
    target.setDate(target.getDate() + diffDias(diaIdx))
    target.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0)
    return target
  }

  if (tipo === 'abrir') {
    // Precisa achar o proximo horario de FECHAMENTO programado (fecha >= agora)
    // Tenta hoje primeiro
    const slotHoje = slotDoDia(diaAtualIdx)
    if (slotHoje && slotHoje.ativo !== false) {
      const fimMin = parseTime(slotHoje.fecha || slotHoje.fim)
      if (fimMin != null && fimMin > minutosHoje) {
        return diaParaTimestamp(diaAtualIdx, fimMin)
      }
    }
    // Senao, procura o proximo dia ativo
    for (let i = 1; i <= 7; i++) {
      const diaIdx = (diaAtualIdx + i) % 7
      const slot = slotDoDia(diaIdx)
      if (slot && slot.ativo !== false) {
        const fimMin = parseTime(slot.fecha || slot.fim)
        if (fimMin != null) return diaParaTimestamp(diaIdx, fimMin)
      }
    }
    return null
  }

  // tipo === 'fechar'
  // Precisa achar o proximo horario de ABERTURA programado (abre >= agora)
  const slotHoje = slotDoDia(diaAtualIdx)
  if (slotHoje && slotHoje.ativo !== false) {
    const inicioMin = parseTime(slotHoje.abre || slotHoje.inicio)
    if (inicioMin != null && inicioMin > minutosHoje) {
      return diaParaTimestamp(diaAtualIdx, inicioMin)
    }
  }
  for (let i = 1; i <= 7; i++) {
    const diaIdx = (diaAtualIdx + i) % 7
    const slot = slotDoDia(diaIdx)
    if (slot && slot.ativo !== false) {
      const inicioMin = parseTime(slot.abre || slot.inicio)
      if (inicioMin != null) return diaParaTimestamp(diaIdx, inicioMin)
    }
  }
  return null
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

        // Calcula se está dentro do horário ATUALMENTE
        const { aberto: horarioAtual, horarioMsg } = verificarLojaAbertaPorHorario(config)

        // Override manual persiste ate o timestamp em
        // config.loja_aberta_override_until. Enquanto nao passou, respeitamos
        // o override (true=aberto, false=fechado). Quando passa, removemos
        // do banco e seguimos o horario automatico.
        const overrideManual = config.loja_aberta
        const overrideUntil = config.loja_aberta_override_until
          ? new Date(config.loja_aberta_override_until)
          : null

        if (overrideManual !== undefined && overrideManual !== null) {
          // Override existe. Verifica se ja expirou.
          const expirou = overrideUntil && overrideUntil.getTime() <= Date.now()
          if (expirou) {
            // Override expirou - remove do banco e segue horario
            const newConfig = { ...config }
            delete newConfig.loja_aberta
            delete newConfig.loja_aberta_override_until
            await supabase.from('tenants').update({ config: newConfig }).eq('id', tenantId)
            setLojaAberta(null)
          } else {
            // Override ainda valido. Respeita o que o lojista definiu,
            // mesmo que esteja fora do horario programado.
            setLojaAberta(overrideManual)
          }
        } else {
          setLojaAberta(null)
        }
      }

      // Usar data local (Brasília) para evitar problemas de timezone
      const agora = new Date()
      const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

      // Início do dia em São Paulo → converter para UTC
      const inicioHojeBrasilia = new Date(brasilia)
      inicioHojeBrasilia.setHours(0, 0, 0, 0)
      // Subtrair 3 horas para obter UTC (Brasília = UTC-3)
      const inicioHojeUTC = new Date(inicioHojeBrasilia.getTime() - 3 * 60 * 60 * 1000)
      // Fim do dia em São Paulo (23:59:59.999)
      const fimHojeBrasilia = new Date(brasilia)
      fimHojeBrasilia.setHours(23, 59, 59, 999)
      const fimHojeUTC = new Date(fimHojeBrasilia.getTime() - 3 * 60 * 60 * 1000)

      const { data: vendasHojeRaw } = await supabase
        .from('pedidos')
        .select('valor_total, pago, status, forma_pagamento, data_criacao')
        .eq('tenant_id', tenantId)
        .gte('data_criacao', inicioHojeUTC.toISOString())
        .lte('data_criacao', fimHojeUTC.toISOString())
        .neq('status', 'cancelado')

      // Faturamento: pago=true OU (entregue E dinheiro)
      const vendasHoje = (vendasHojeRaw || []).filter(p =>
        p.pago === true || (p.status === 'entregue' && p.forma_pagamento === 'dinheiro')
      )
      setTotalHoje(vendasHoje.reduce((s, p) => s + Number(p.valor_total), 0))
      setPedidosHoje(vendasHoje.length)

      // Primeiro dia do mês em São Paulo → UTC
      const primeiroDiaBrasilia = new Date(brasilia.getFullYear(), brasilia.getMonth(), 1)
      const primeiroDiaUTC = new Date(primeiroDiaBrasilia.getTime() - 3 * 60 * 60 * 1000)

      const { data: vendasMesRaw } = await supabase
        .from('pedidos')
        .select('valor_total, pago, status, forma_pagamento')
        .eq('tenant_id', tenantId)
        .gte('data_criacao', primeiroDiaUTC.toISOString())
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

  // Recalcular status baseado no horarios state
  const calculoHorario = horarios
    ? verificarLojaAbertaPorHorario({ horarios_dias: horarios })
    : { aberto: false, horarioMsg: '' }
  const abertoPorHorario = calculoHorario.aberto
  const horarioMsg = calculoHorario.horarioMsg

  // Lógica: lojaAbertaOverride pode ser true/false/null
  // - null = seguir horário automático
  // - true = forçar aberta
  // - false = forçar fechada

  const estaForaDoHorario = !abertoPorHorario
  const temOverride = lojaAberta !== null
  const lojaEstaAberta = lojaAberta === true || (!temOverride && abertoPorHorario)

  const podeFechar = lojaEstaAberta && (temOverride || estaForaDoHorario)
  const podeAbrir = !lojaEstaAberta

  const copiarLink = async () => {
    const url = `${window.location.origin}/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const abrirLoja = async () => {
    setToggleLoading(true)
    try {
      const tenantId = await activeTenantId()
      if (!tenantId) { setToggleLoading(false); return }

      // Busca config atual
      const { data: current } = await supabase
        .from('tenants')
        .select('config')
        .eq('id', tenantId)
        .single()

      const config = (current?.config as any) || {}
      config.loja_aberta = true // Forçar aberta
      // Calcula ate quando o override vale: proximo horario programado
      // de fechamento do dia (ou proximo dia ativo se ja fechou).
      const expiraEm = calcularExpiracaoOverride(config.horarios_dias, 'abrir')
      if (expiraEm) {
        config.loja_aberta_override_until = expiraEm.toISOString()
      } else {
        delete config.loja_aberta_override_until
      }

      await supabase
        .from('tenants')
        .update({ config })
        .eq('id', tenantId)

      setLojaAberta(true)
    } catch (err) {
      console.error('Erro abrir loja:', err)
    } finally {
      setToggleLoading(false)
    }
  }

  const fecharLoja = async () => {
    setToggleLoading(true)
    try {
      const tenantId = await activeTenantId()
      if (!tenantId) { setToggleLoading(false); return }

      // Busca config atual
      const { data: current } = await supabase
        .from('tenants')
        .select('config')
        .eq('id', tenantId)
        .single()

      const config = (current?.config as any) || {}
      config.loja_aberta = false // Forçar fechada
      // Expira no proximo horario programado de abertura (hoje se ainda
      // nao abriu, senao proximo dia ativo).
      const expiraEm = calcularExpiracaoOverride(config.horarios_dias, 'fechar')
      if (expiraEm) {
        config.loja_aberta_override_until = expiraEm.toISOString()
      } else {
        delete config.loja_aberta_override_until
      }

      await supabase
        .from('tenants')
        .update({ config })
        .eq('id', tenantId)

      setLojaAberta(false)
    } catch (err) {
      console.error('Erro fechar loja:', err)
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
            {/* Status da loja */}
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: lojaEstaAberta ? '#16A34A' : '#DC2626' }}
              />
              <span style={{ color: lojaEstaAberta ? '#15803D' : '#B91C1C' }}>
                {lojaEstaAberta ? 'Aberta' : 'Fechada'}
              </span>
              {horarioMsg && (
                <span className="text-gray-400">· {horarioMsg}</span>
              )}
            </div>

            {/* Botão Abrir/Fechar - aparece sempre quando lojista quer mudar */}
            {(podeAbrir || podeFechar) && (
              <button
                onClick={lojaEstaAberta ? fecharLoja : abrirLoja}
                disabled={toggleLoading}
                className={`px-2 py-1 text-xs rounded-lg transition flex items-center gap-1 ${
                  lojaEstaAberta
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                title={lojaEstaAberta ? 'Fechar loja' : 'Abrir loja'}
              >
                {toggleLoading ? (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Power size={10} />
                    <span className="hidden sm:inline">
                      {lojaEstaAberta ? 'Fechar' : 'Abrir'}
                    </span>
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
          onClick={copiarLink}
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
