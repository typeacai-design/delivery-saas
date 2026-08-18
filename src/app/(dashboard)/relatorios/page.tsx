'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import {
  FileText, BarChart3, Calendar, Package, Sparkles, Download, ChevronRight, Eye
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Relatorio = 'periodo' | 'item' | 'complemento'

export default function RelatoriosPage() {
  const [tab, setTab] = useState<Relatorio>('periodo')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [loading, setLoading] = useState(true)
  const [vendasPorDia, setVendasPorDia] = useState<{ dia: string; total: number; count: number }[]>([])
  const [vendasPorItem, setVendasPorItem] = useState<{ nome: string; qtd: number; total: number }[]>([])
  const [vendasPorComplemento, setVendasPorComplemento] = useState<{ nome: string; qtd: number; total: number }[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    // Defaults: últimos 30 dias
    const fim = new Date()
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 30)
    setDataFim(fim.toISOString().split('T')[0])
    setDataInicio(inicio.toISOString().split('T')[0])
    loadData()
  }, [])

  useEffect(() => {
    if (dataInicio && dataFim) loadData()
  }, [dataInicio, dataFim])

  const loadData = async () => {
    setLoading(true)
    const tenantId = await activeTenantId()
    if (!tenantId) { setLoading(false); return }

    const inicio = `${dataInicio}T00:00:00`
    const fim = `${dataFim}T23:59:59`

    // Vendas por dia
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, valor_total, data_criacao')
      .eq('tenant_id', tenantId)
      .gte('data_criacao', inicio)
      .lte('data_criacao', fim)
      .neq('status', 'cancelado')

    const gruposDia: Record<string, { total: number; count: number }> = {}
    let total = 0
    pedidos?.forEach((p) => {
      const dia = p.data_criacao.split('T')[0]
      if (!gruposDia[dia]) gruposDia[dia] = { total: 0, count: 0 }
      gruposDia[dia].total += Number(p.valor_total)
      gruposDia[dia].count += 1
      total += Number(p.valor_total)
    })
    setVendasPorDia(
      Object.entries(gruposDia).map(([dia, d]) => ({ dia, ...d })).sort((a, b) => a.dia.localeCompare(b.dia))
    )
    setTotalGeral(total)

    // Vendas por item
    const { data: itens } = await supabase
      .from('pedido_itens')
      .select('nome, quantidade, valor_unitario, pedidos!inner(data_criacao, status, tenant_id)')
      .gte('pedidos.data_criacao', inicio)
      .lte('pedidos.data_criacao', fim)
      .neq('pedidos.status', 'cancelado')
      .eq('pedidos.tenant_id', tenantId)

    const gruposItem: Record<string, { qtd: number; total: number }> = {}
    itens?.forEach((i: any) => {
      const k = i.nome
      if (!gruposItem[k]) gruposItem[k] = { qtd: 0, total: 0 }
      gruposItem[k].qtd += i.quantidade
      gruposItem[k].total += i.quantidade * Number(i.valor_unitario)
    })
    setVendasPorItem(
      Object.entries(gruposItem).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.total - a.total)
    )

    // Vendas por complemento
    const { data: comps } = await supabase
      .from('pedido_complementos')
      .select('nome, quantidade, valor, pedido_itens!inner(pedidos!inner(data_criacao, status, tenant_id))')
      .gte('pedido_itens.pedidos.data_criacao', inicio)
      .lte('pedido_itens.pedidos.data_criacao', fim)
      .neq('pedido_itens.pedidos.status', 'cancelado')
      .eq('pedido_itens.pedidos.tenant_id', tenantId)

    const gruposComp: Record<string, { qtd: number; total: number }> = {}
    comps?.forEach((c: any) => {
      const k = c.nome
      if (!gruposComp[k]) gruposComp[k] = { qtd: 0, total: 0 }
      gruposComp[k].qtd += c.quantidade
      gruposComp[k].total += c.quantidade * Number(c.valor)
    })
    setVendasPorComplemento(
      Object.entries(gruposComp).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.total - a.total)
    )

    setLoading(false)
  }

  const tabs = [
    { id: 'periodo', label: 'Por período', icon: Calendar },
    { id: 'item', label: 'Por item', icon: Package },
    { id: 'complemento', label: 'Por complementos', icon: Sparkles },
  ] as const

  const max = vendasPorDia.length ? Math.max(...vendasPorDia.map(v => v.total)) : 1

  return (
    <div>
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2 flex items-center gap-1.5">
              <FileText size={11} />
              Análise
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
              Relatórios
            </h1>
            <p className="hint mt-2">Vendas por período, item e complemento</p>
          </div>
          <button className="btn-primary">
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      <VisitantesCard />

      {/* Filtro de período + tabs */}
      <div className="glass p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 items-center">
            <Calendar size={14} style={{ color: 'var(--ink-faint)' }} />
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: 8, width: 'auto' }} />
            <span className="hint">até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: 8, width: 'auto' }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {tabs.map((t) => {
              const active = tab === t.id
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition"
                  style={
                    active
                      ? { background: 'var(--grad-violet)', color: 'white' }
                      : { background: 'rgba(255,255,255,.6)', border: '1px solid var(--line)', color: 'var(--ink-muted)' }
                  }
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="glass p-5">
          <div className="eyebrow mb-2">Faturamento total</div>
          <div className="text-3xl font-semibold gradient-num">{formatCurrency(totalGeral)}</div>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2">Pedidos</div>
          <div className="text-3xl font-semibold gradient-text-teal">
            {vendasPorDia.reduce((s, v) => s + v.count, 0)}
          </div>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2">Ticket médio</div>
          <div className="text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            {formatCurrency(vendasPorDia.reduce((s, v) => s + v.count, 0) > 0 ? totalGeral / vendasPorDia.reduce((s, v) => s + v.count, 0) : 0)}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="text-center py-8 hint">Carregando...</div>
      ) : (
        <>
          {tab === 'periodo' && (
            <div className="glass p-6">
              <div className="eyebrow mb-1">Distribuição</div>
              <h2 className="text-lg font-semibold mb-5">Vendas por dia</h2>
              {vendasPorDia.length === 0 ? (
                <div className="text-center py-8 hint">Sem vendas no período</div>
              ) : (
                <div className="space-y-2">
                  {vendasPorDia.map((v) => (
                    <div key={v.dia} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-mono" style={{ color: 'var(--ink-2)' }}>
                        {new Date(v.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="flex-1 h-8 rounded-xl relative overflow-hidden" style={{ background: 'rgba(255,255,255,.4)' }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-xl transition-all"
                          style={{
                            background: 'var(--grad-violet)',
                            width: `${(v.total / max) * 100}%`,
                            minWidth: '8px',
                          }}
                        />
                      </div>
                      <div className="w-32 text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(v.total)}
                      </div>
                      <div className="w-16 text-right hint text-xs">{v.count} ped.</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'item' && (
            <div className="glass p-6">
              <div className="eyebrow mb-1">Ranking</div>
              <h2 className="text-lg font-semibold mb-5">Itens mais vendidos</h2>
              {vendasPorItem.length === 0 ? (
                <div className="text-center py-8 hint">Sem vendas no período</div>
              ) : (
                <div className="space-y-2">
                  {vendasPorItem.map((i, idx) => (
                    <div key={i.nome} className="glass-soft p-4 flex items-center gap-4">
                      <div className="size-10 rounded-2xl flex items-center justify-center font-bold text-sm" style={{
                        background: idx === 0 ? 'linear-gradient(135deg, #FCD34D, #F59E0B)' : idx === 1 ? 'linear-gradient(135deg, #D1D5DB, #9CA3AF)' : idx === 2 ? 'linear-gradient(135deg, #FED7AA, #FB923C)' : 'rgba(139,92,246,.12)',
                        color: idx < 3 ? 'white' : 'var(--ink)',
                      }}>{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{i.nome}</div>
                        <div className="hint text-xs">{i.qtd} unidades</div>
                      </div>
                      <div className="text-base font-semibold gradient-text">
                        {formatCurrency(i.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'complemento' && (
            <div className="glass p-6">
              <div className="eyebrow mb-1">Upsell</div>
              <h2 className="text-lg font-semibold mb-5">Complementos mais pedidos</h2>
              {vendasPorComplemento.length === 0 ? (
                <div className="text-center py-8 hint">Sem vendas no período</div>
              ) : (
                <div className="space-y-2">
                  {vendasPorComplemento.map((c, idx) => (
                    <div key={c.nome} className="glass-soft p-4 flex items-center gap-4">
                      <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(244,114,182,.14)' }}>
                        <Sparkles size={16} style={{ color: '#BE185D' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{c.nome}</div>
                        <div className="hint text-xs">{c.qtd} vezes pedido</div>
                      </div>
                      <div className="text-base font-semibold" style={{ color: '#BE185D' }}>
                        {formatCurrency(c.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  )
}

/* ===========================================================
   COMPONENTE: VisitantesCard
   Mostra contagem de page-views do cardápio público
   =========================================================== */
function VisitantesCard() {
  const [periodo, setPeriodo] = useState<'24h' | '7d' | '30d' | 'all'>('7d')
  const [dados, setDados] = useState<{ total: number; porDia: { data: string; views: number }[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetch(`/api/analytics?periodo=${periodo}`)
      .then((r) => r.json())
      .then((d) => {
        if (mounted) {
          setDados(d)
          setLoading(false)
        }
      })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [periodo])

  const max = Math.max(1, ...(dados?.porDia || []).map((d) => d.views))

  return (
    <div className="glass p-5 mb-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <Eye size={18} className="text-purple-700" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Visitantes do cardápio</div>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? '...' : dados?.total ?? 0}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {[
            { id: '24h', label: '24h' },
            { id: '7d', label: '7 dias' },
            { id: '30d', label: '30 dias' },
            { id: 'all', label: 'Tudo' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id as any)}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={
                periodo === p.id
                  ? { background: 'var(--green)', color: 'white' }
                  : { background: 'rgba(0,0,0,.05)', color: '#6B7280' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {dados && dados.porDia.length > 0 ? (
        <div className="flex items-end gap-1 h-20">
          {dados.porDia.slice(-14).map((d) => (
            <div
              key={d.data}
              className="flex-1 rounded-t-md"
              style={{
                background: 'var(--grad-violet)',
                height: `${(d.views / max) * 100}%`,
                minHeight: '4px',
              }}
              title={`${d.data}: ${d.views} views`}
            />
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-400 text-center py-4">
          {loading ? 'Carregando...' : 'Sem dados no período'}
        </div>
      )}
    </div>
  )
}

