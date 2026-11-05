'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import {
  FileText, BarChart3, Calendar, Package, Sparkles, Download, TrendingUp, DollarSign, Eye
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Relatorio = 'periodo' | 'item' | 'complemento' | 'pagamento' | 'dias' | 'horarios' | 'semana' | 'modalidade' | 'cancelamentos'

export default function RelatoriosPage() {
  const [tab, setTab] = useState<Relatorio>('periodo')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [vendasPorDia, setVendasPorDia] = useState<{ dia: string; total: number; count: number }[]>([])
  const [vendasPorItem, setVendasPorItem] = useState<{ nome: string; qtd: number; total: number }[]>([])
  const [vendasPorComplemento, setVendasPorComplemento] = useState<{ nome: string; qtd: number; total: number }[]>([])
  const [vendasPorFormaPagamento, setVendasPorFormaPagamento] = useState<Record<string, number>>({})
  const [diasMaisVendas, setDiasMaisVendas] = useState<{ dia: string; total: number; count: number }[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [relatorioExtra, setRelatorioExtra] = useState<Record<string, { nome: string; qtd: number; total: number }[]>>({})
  const [erroRelatorio, setErroRelatorio] = useState('')
  const [totalEntradas, setTotalEntradas] = useState(0)
  const [totalSaidas, setTotalSaidas] = useState(0)
  const [ticketMedio, setTicketMedio] = useState(0)
  const [numeroPedidosPagos, setNumeroPedidosPagos] = useState(0)
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
  }, [dataInicio, dataFim, formaPagamento, statusFilter])

  const loadData = async () => {
    if (!dataInicio || !dataFim) return
    setLoading(true)
    setErroRelatorio('')
    try {
      const tenantId = await activeTenantId()
      if (!tenantId) throw new Error('Loja não identificada')
      if (dataInicio > dataFim) throw new Error('A data inicial deve ser anterior à data final')
      // Os limites são calculados no horário de Brasília, não em UTC.
      const inicio = new Date(dataInicio + 'T00:00:00-03:00').toISOString()
      const fim = new Date(dataFim + 'T23:59:59.999-03:00').toISOString()
      const [{data: pedidos, error: erroPedidos}, {data: movimentos, error: erroMovimentos}, {data: sessoes, error: erroMesas}] = await Promise.all([
        supabase.from('pedidos').select('id,valor_total,data_criacao,status,forma_pagamento,valor_pago,pago,tipo_pedido,tipo_entrega,sessao_mesa_id,motivo_cancelamento,deleted_at').eq('tenant_id',tenantId).gte('data_criacao',inicio).lte('data_criacao',fim).is('deleted_at',null).limit(10000),
        supabase.from('movimentacoes_financeiras').select('id,tipo,valor,data,referencia_id,categoria').eq('tenant_id',tenantId).gte('data',dataInicio).lte('data',dataFim).limit(10000),
        supabase.from('sessoes_mesa').select('id,valor_total,forma_pagamento,data_fechamento,status').eq('tenant_id',tenantId).eq('status','fechada').gte('data_fechamento',inicio).lte('data_fechamento',fim).limit(10000),
      ])
      if(erroPedidos||erroMovimentos||erroMesas) throw new Error(erroPedidos?.message||erroMovimentos?.message||erroMesas?.message)
      const todos = pedidos||[]
      const validos = todos.filter(p=>p.status!=='cancelado' && p.pago===true && !p.sessao_mesa_id && (!statusFilter || p.status===statusFilter))
      const pagamentos=(formas:any, valores:any, total:number) => {
        const fs=Array.isArray(formas)?formas.filter(Boolean):formas?[formas]:[]
        if(!fs.length)return [{nome:'Não informado',valor:total}]
        if(fs.length===1)return [{nome:fs[0],valor:total}]
        const vs=Array.isArray(valores)?valores.map(Number):[]
        if(vs.length===fs.length && vs.every(v=>Number.isFinite(v)&&v>=0) && vs.reduce((s,v)=>s+v,0)>0){
          const soma=vs.reduce((s,v)=>s+v,0)
          return fs.map((nome,i)=>({nome,valor:total*vs[i]/soma}))
        }
        return [{nome:'Pagamento misto',valor:total}]
      }
      const vendas = [
        ...validos.map(p=>({id:p.id,data:p.data_criacao,valor:Number(p.valor_total)||0,formas:pagamentos(p.forma_pagamento,p.valor_pago,Number(p.valor_total)||0),tipo:p.tipo_pedido||p.tipo_entrega||'Não informado'})),
        ...(!statusFilter||statusFilter==='entregue'?(sessoes||[]):[]).map(s=>({id:s.id,data:s.data_fechamento!,valor:Number(s.valor_total)||0,formas:pagamentos(s.forma_pagamento,null,Number(s.valor_total)||0),tipo:'mesa'})),
      ].filter(v=>!formaPagamento||v.formas.some(f=>f.nome===formaPagamento))
      const gruposDia:Record<string,{total:number;count:number}>={}
      const gruposForma:Record<string,number>={}
      const extras:Record<string,Record<string,{nome:string;qtd:number;total:number}>>={horarios:{},semana:{},modalidade:{},cancelamentos:{}}
      const add=(categoria:string,nome:string,valor:number)=>{const g=extras[categoria];if(!g[nome])g[nome]={nome,qtd:0,total:0};g[nome].qtd++;g[nome].total+=valor}
      let total=0
      for(const v of vendas){
        const data=new Date(v.data)
        const dia=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(data)
        const hora=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(data)+'h'
        const semana=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long'}).format(data)
        if(!gruposDia[dia])gruposDia[dia]={total:0,count:0}
        gruposDia[dia].total+=v.valor;gruposDia[dia].count++;total+=v.valor
        for(const f of v.formas)gruposForma[f.nome]=(gruposForma[f.nome]||0)+f.valor
        add('horarios',hora,v.valor);add('semana',semana,v.valor);add('modalidade',v.tipo,v.valor)
      }
      for(const p of todos.filter(p=>p.status==='cancelado'&&(!formaPagamento||(Array.isArray(p.forma_pagamento)&&p.forma_pagamento.includes(formaPagamento)))))add('cancelamentos',p.motivo_cancelamento||'Não informado',Number(p.valor_total)||0)
      setRelatorioExtra(Object.fromEntries(Object.entries(extras).map(([k,v])=>[k,Object.values(v).sort((a,b)=>b.total-a.total)])))
      setTotalGeral(total);setTotalEntradas(total);setNumeroPedidosPagos(vendas.length);setTicketMedio(vendas.length?total/vendas.length:0)
      setVendasPorDia(Object.entries(gruposDia).map(([dia,d])=>({dia,...d})).sort((a,b)=>a.dia.localeCompare(b.dia)))
      setVendasPorFormaPagamento(gruposForma)
      setDiasMaisVendas(Object.entries(gruposDia).map(([dia,d])=>({dia,...d})).sort((a,b)=>b.total-a.total).slice(0,5))
      // Saídas registradas no fluxo financeiro, respeitando o período.
      setTotalSaidas((movimentos||[]).filter(m=>m.tipo==='saida').reduce((s,m)=>s+Number(m.valor||0),0))
      // Rankings limitados a pedidos efetivamente pagos; sessões de mesa são consolidadas apenas no financeiro.
      const ids=todos.filter(p=>p.status!=='cancelado'&&p.pago===true&&(!statusFilter||p.status===statusFilter)&&(!formaPagamento||(Array.isArray(p.forma_pagamento)&&p.forma_pagamento.includes(formaPagamento)))).map(p=>p.id)
      const itens: any[]=[]
      for(let i=0;i<ids.length;i+=200){const {data,error}=await supabase.from('pedido_itens').select('id,nome,quantidade,valor_unitario,complementos').in('pedido_id',ids.slice(i,i+200));if(error)throw error;itens.push(...(data||[]))}
      const porItem:Record<string,{qtd:number;total:number}>={}
      const porComp:Record<string,{qtd:number;total:number}>={}
      for(const item of itens){
        const nome=item.nome||'Sem nome';if(!porItem[nome])porItem[nome]={qtd:0,total:0}
        porItem[nome].qtd+=Number(item.quantidade)||0;porItem[nome].total+=(Number(item.quantidade)||0)*(Number(item.valor_unitario)||0)
        const cs=Array.isArray(item.complementos)?item.complementos:[]
        for(const comp of cs){const cn=comp.nome||comp.name;if(!cn)continue;if(!porComp[cn])porComp[cn]={qtd:0,total:0};const qtd=(Number(comp.quantidade)||1)*(Number(item.quantidade)||1);porComp[cn].qtd+=qtd;porComp[cn].total+=qtd*Number(comp.valor??comp.preco??0)}
      }
      setVendasPorItem(Object.entries(porItem).map(([nome,d])=>({nome,...d})).sort((a,b)=>b.total-a.total))
      setVendasPorComplemento(Object.entries(porComp).map(([nome,d])=>({nome,...d})).sort((a,b)=>b.total-a.total))
    }catch(e:any){setErroRelatorio(e?.message||'Não foi possível carregar os relatórios')}
    finally{setLoading(false)}
  }

  const tabs = [
    { id: 'periodo', label: 'Por período', icon: Calendar },
    { id: 'pagamento', label: 'Por pagto', icon: BarChart3 },
    { id: 'item', label: 'Por item', icon: Package },
    { id: 'complemento', label: 'Complementos', icon: Sparkles },
    { id: 'dias', label: 'Top dias', icon: TrendingUp },
    { id: 'horarios', label: 'Horários de pico', icon: Calendar },
    { id: 'semana', label: 'Dias da semana', icon: Calendar },
    { id: 'modalidade', label: 'Modalidades', icon: Package },
    { id: 'cancelamentos', label: 'Cancelamentos', icon: FileText },
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
          <button className="btn-primary" onClick={() => {
            const rows = [['Relatório','Nome','Quantidade','Valor'], ...Object.entries(relatorioExtra).flatMap(([tipo, dados])=>dados.map(d=>[tipo,d.nome,String(d.qtd),String(d.total)])), ...vendasPorDia.map(d=>['Vendas por dia',d.dia,String(d.count),String(d.total)]), ...vendasPorItem.map(d=>['Produtos',d.nome,String(d.qtd),String(d.total)]), ...vendasPorComplemento.map(d=>['Complementos',d.nome,String(d.qtd),String(d.total)])]
            const csv='\\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\\r\\n')
            const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download='relatorios-'+dataInicio+'-'+dataFim+'.csv';link.click();URL.revokeObjectURL(url)
          }}>
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      <VisitantesCard />

      {/* Filtro de período + tabs */}
      <div className="glass p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 items-center flex-wrap">
            <Calendar size={14} style={{ color: 'var(--ink-faint)' }} />
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: 8, width: 'auto' }} />
            <span className="hint">até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: 8, width: 'auto' }} />
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: 8 }} className="form-input">
              <option value="">Todas formas</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão Crédito</option>
              <option value="cartao_debito">Cartão Débito</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: 8 }} className="form-input">
              <option value="">Todos status</option>
              <option value="entregue">Entregues</option>
              <option value="saiu">Saiu</option>
              <option value="pronto">Pronto</option>
              <option value="preparando">Preparando</option>
              <option value="novo">Novos</option>
            </select>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><DollarSign size={12}/> Entradas</div>
          <div className="text-2xl font-semibold text-green-600">{formatCurrency(totalEntradas)}</div>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><DollarSign size={12}/> Saídas</div>
          <div className="text-2xl font-semibold text-red-600">{formatCurrency(totalSaidas)}</div>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><TrendingUp size={12}/> Saldo</div>
          <div className="text-2xl font-semibold" style={{ color: totalEntradas - totalSaidas >= 0 ? 'var(--green)' : '#DC2626' }}>
            {formatCurrency(totalEntradas - totalSaidas)}
          </div>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2">Pedidos</div>
          <div className="text-2xl font-semibold gradient-text-teal">
            {numeroPedidosPagos}
          </div>
        </div>
        <div className="glass p-5">
          <div className="eyebrow mb-2 flex items-center gap-1"><BarChart3 size={12}/> Ticket Médio</div>
          <div className="text-2xl font-semibold gradient-text-teal">
            {formatCurrency(ticketMedio)}
          </div>
          <div className="hint text-[10px] mt-1">por pedido pago</div>
        </div>
      </div>

      {erroRelatorio && <div role="alert" className="p-4 mb-4 rounded-xl bg-red-50 text-red-700">{erroRelatorio}</div>}
      {/* Conteúdo */}
      {loading ? (
        <div className="text-center py-8 hint">Carregando...</div>
      ) : (
        <>
          {(['horarios','semana','modalidade','cancelamentos'] as const).includes(tab as any) && (
            <div className="glass p-6"><h2 className="text-lg font-semibold mb-5">{({horarios:'Vendas por horário',semana:'Vendas por dia da semana',modalidade:'Delivery, retirada e mesas',cancelamentos:'Pedidos cancelados por motivo'} as Record<string,string>)[tab]}</h2>
              {(relatorioExtra[tab]||[]).length===0?<p className="hint">Sem registros no período</p>:(relatorioExtra[tab]||[]).map(d=><div key={d.nome} className="glass-soft p-4 flex items-center justify-between gap-3 mb-2"><div><div className="font-semibold">{d.nome}</div><div className="hint text-xs">{d.qtd} pedidos</div></div><div className="font-semibold text-green-700">{formatCurrency(d.total)}</div></div>)}
            </div>
          )}
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

          {tab === 'pagamento' && (
            <div className="glass p-6">
              <div className="eyebrow mb-1">Métodos</div>
              <h2 className="text-lg font-semibold mb-5">Vendas por forma de pagamento</h2>
              {Object.keys(vendasPorFormaPagamento).length === 0 ? (
                <div className="text-center py-8 hint">Sem vendas no período</div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(vendasPorFormaPagamento)
                    .sort((a, b) => b[1] - a[1])
                    .map(([forma, valor]) => {
                      const labels: Record<string, string> = {
                        dinheiro: '💵 Dinheiro',
                        pix: '🔑 PIX',
                        cartao_credito: '💳 Cartão Crédito',
                        cartao_debito: '💳 Cartão Débito',
                        nao_informado: '❓ Não informado'
                      }
                      return (
                        <div key={forma} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                          <div className="w-32 font-medium">{labels[forma] || forma}</div>
                          <div className="flex-1 h-6 rounded-lg bg-white relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 rounded-lg bg-green-500" style={{ width: `${(valor / totalGeral) * 100}%` }} />
                          </div>
                          <div className="w-32 text-right font-semibold text-green-600">{formatCurrency(valor)}</div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )}

          {tab === 'dias' && (
            <div className="glass p-6">
              <div className="eyebrow mb-1">Ranking</div>
              <h2 className="text-lg font-semibold mb-5">Dias com mais vendas</h2>
              {diasMaisVendas.length === 0 ? (
                <div className="text-center py-8 hint">Sem vendas no período</div>
              ) : (
                <div className="space-y-2">
                  {diasMaisVendas.map((d, idx) => (
                    <div key={d.dia} className="glass-soft p-4 flex items-center gap-4">
                      <div className="size-10 rounded-2xl flex items-center justify-center font-bold text-sm" style={{
                        background: idx === 0 ? 'linear-gradient(135deg, #FCD34D, #F59E0B)' : idx === 1 ? 'linear-gradient(135deg, #D1D5DB, #9CA3AF)' : idx === 2 ? 'linear-gradient(135deg, #FED7AA, #FB923C)' : 'rgba(139,92,246,.12)',
                        color: idx < 3 ? 'white' : 'var(--ink)',
                      }}>{idx + 1}</div>
                      <div className="flex-1">
                        <div className="font-semibold" style={{ color: 'var(--ink)' }}>{new Date(d.dia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                        <div className="hint text-xs">{d.count} pedidos</div>
                      </div>
                      <div className="text-xl font-semibold gradient-text">{formatCurrency(d.total)}</div>
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
            <div className="text-xs text-gray-500">Visualizações do cardápio</div>
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

