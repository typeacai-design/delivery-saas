'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WalletCards, Receipt, CreditCard, Plus, X, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/toast'
import MerchantDisclosure from '@/components/merchant-disclosure'

import MerchantDateRange from '@/components/merchant-date-range'
import { currentMonthRange } from '@/lib/finance-period'
import { useMerchantMobile } from '@/lib/use-merchant-mobile'

type Tab = 'cashflow'|'accounts'|'payments'
type Order = { id:string; codigo:string|null; created_at:string; valor_total:number; taxa_entrega:number; forma_pagamento:string; status:string; pago:boolean|null; sessao_mesa_id?:string|null }
type Expense = { id:string; nome:string; valor:number; dia_vencimento?:number|null; recorrencia?:string|null; created_at:string; pago:boolean|null }
type ManualTransaction = { id:string; tipo:'entrada'|'saida'; descricao:string; valor:number; data:string; categoria:string }

const tabs = [
  ['cashflow','Fluxo de caixa',WalletCards],
  ['accounts','Contas a pagar/receber',Receipt],
  ['payments','Formas de pagamento',CreditCard],
] as const

export default function FinanceiroPage(){
 const mobile=useMerchantMobile(),[mounted,setMounted]=useState(false)
 useEffect(()=>setMounted(true),[])
 return !mounted ? <div className="hint p-8">Carregando dados financeiros…</div> : mobile ? <MobileFinance/> : <DesktopFinance/>
}
function DesktopFinance(){
  const { error: toastError, success: toastSuccess } = useToast()
  const supabase=useMemo(()=>createClient(),[])
  const [tab,setTab]=useState<Tab>('cashflow')
  const [orders,setOrders]=useState<Order[]>([])
  const [expenses,setExpenses]=useState<Expense[]>([])
  const [transactions,setTransactions]=useState<ManualTransaction[]>([])
  const [tenant,setTenant]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [showLancar,setShowLancar]=useState(false)
  const [saldoTotal,setSaldoTotal]=useState(0)

  useEffect(()=>{(async()=>{
    try{
      const response=await fetch('/api/financeiro',{cache:'no-store'})
      const body=await response.json()
      if(!response.ok)throw new Error(body.error)
      setOrders(body.orders||[])
      setExpenses(body.expenses||[])
      setTransactions(body.transactions||[])
      setTenant(body.tenant)
      // Calcular saldo SEM duplicação:
      // - Entradas: transactions manuais (todas as de tipo='entrada')
      //   + pedidos pagos que NÃO têm transação manual correspondente
      // - Saídas: despesas + transactions manuais de tipo='saida'
      const pedidosComTransacao = new Set(
        (body.transactions||[])
          .filter((t:any) => t.categoria === 'pedido' && t.descricao)
          .map((t:any) => t.descricao as string)
      )
      const entradasPedidosSemTransacao = (body.orders||[])
        .filter((o:any) => {
          if (o.pago !== true || o.status === 'cancelado' || o.sessao_mesa_id) return false
          const labelComHash = `Pedido #${o.codigo || o.id.slice(0,8)}`
          const labelSemHash = `Pedido ${o.codigo || o.id.slice(0,8)}`
          return !pedidosComTransacao.has(labelComHash) && !pedidosComTransacao.has(labelSemHash)
        })
        .reduce((s:number,o:any)=>s+Number(o.valor_total||0),0)
      const entradasManuais = (body.transactions||[])
        .filter((t:any) => t.tipo === 'entrada')
        .reduce((s:number,t:any)=>s+Number(t.valor||0),0)
      const saidasDespesas = (body.expenses||[]).reduce((s:number,e:any)=>s+Number(e.valor||0),0)
      const saidasManuais = (body.transactions||[])
        .filter((t:any) => t.tipo === 'saida')
        .reduce((s:number,t:any)=>s+Number(t.valor||0),0)
      setSaldoTotal(entradasPedidosSemTransacao + entradasManuais - saidasDespesas - saidasManuais)
    }finally{setLoading(false)}
  })()},[])

  if(loading)return <div className="hint p-8">Carregando dados financeiros…</div>

  return <div className="wd-finance-page space-y-5">
    <header className="wd-page-heading">
      <div className="eyebrow mb-2">Financeiro</div>
      <h1 className="text-3xl font-semibold"><span className="wd-desktop-label">Gestão financeira</span><span className="wd-mobile-label">Financeiro</span></h1><p className="wd-mobile-subtitle">Seu dinheiro, sem complicação</p>
      <div className="wd-finance-desktop-balance flex items-center gap-4 mt-2">
        <span className={`text-2xl font-bold ${saldoTotal>=0?'text-green-600':'text-red-600'}`}>
          Saldo: {formatCurrency(saldoTotal)}
        </span>
        <span className={`text-sm ${saldoTotal>=0?'text-green-500':'text-red-500'}`}>
          {saldoTotal>=0?'▲ Positivo':'▼ Negativo'}
        </span>
      </div>
    </header>
    <div className="wd-finance-summary">
      <section className="wd-sales"><div className="wd-sales-top">Recebido · todo o período disponível</div><strong className="wd-total">{formatCurrency(orders.filter(o => o.pago === true && o.status !== 'cancelado').reduce((sum, o) => sum + Number(o.valor_total || 0), 0))}</strong><p>Somente pedidos marcados como pagos</p></section>
      <div className="wd-finance-metrics"><div className="wd-metric"><span>A receber em pedidos</span><b>{formatCurrency(orders.filter(o => o.pago !== true && o.status !== 'cancelado').reduce((sum, o) => sum + Number(o.valor_total || 0), 0))}</b></div><div className="wd-metric"><span>Saldo do fluxo de caixa</span><b>{formatCurrency(saldoTotal)}</b></div></div>
      <button type="button" className="wd-action wd-primary" onClick={() => setShowLancar(true)}><Plus size={18} aria-hidden="true" />Lançar movimentação</button>
    </div>
    <div className="wd-finance-tabs grid grid-cols-2 md:grid-cols-3 gap-3">
      {tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`glass-soft min-h-24 rounded-2xl p-4 text-left transition ${tab===id?'ring-2 ring-green-500':''}`}><Icon size={18}/><span className="block text-sm font-semibold mt-2">{label}</span></button>)}
    </div>
    {tab==='cashflow'&&<CashFlow orders={orders} expenses={expenses} transactions={transactions} onNewTransaction={()=>setShowLancar(true)} onSaved={()=>{setShowLancar(false);window.location.reload()}}/>}
    {tab==='accounts'&&<Accounts orders={orders} expenses={expenses} onNewExpense={()=>setShowLancar(true)}/>}
    {tab==='payments'&&<Payments tenant={tenant} onSaved={setTenant}/>}
    {showLancar&&<LancarModal onClose={()=>setShowLancar(false)} onSave={()=>{setShowLancar(false);window.location.reload()}}/>}
  </div>
}

const Empty=({text}:{text:string})=><p className="hint text-sm py-8 text-center">{text}</p>

function CashFlow({orders,expenses,transactions,onNewTransaction,onSaved}:{orders:Order[];expenses:Expense[];transactions:ManualTransaction[];onNewTransaction:()=>void;onSaved:()=>void}){
  // Constrói a lista:
  // 1) Transactions manuais SEMPRE aparecem (incluindo categoria='pedido' vindas do trigger)
  // 2) Despesas aparecem como saída
  // 3) Orders pagos aparecem APENAS se não há transação manual correspondente
  //    (evita duplicação quando o trigger já inseriu automaticamente)
  const transacoesPedidoDescricoes = new Set(
    transactions
      .filter(t => t.categoria === 'pedido' && t.descricao)
      .map(t => t.descricao as string)
  )

  const rows=[
    // 1) Transações manuais PRIMEIRO (incluindo as de pedidos via trigger)
    ...transactions.map(t=>({
      date:t.data,
      label:t.descricao,
      value:t.tipo==='entrada'?Number(t.valor):-Number(t.valor),
      kind:t.tipo as 'entrada' | 'saida',
      pago:null as null,
      status:null as null
    })),
    // 2) Pedidos pagos que NÃO têm transação manual
    ...orders.filter(o => {
      if (o.pago !== true) return false
      if (o.status === 'cancelado' || o.sessao_mesa_id) return false
      const labelComHash = `Pedido #${o.codigo || o.id.slice(0,8)}`
      const labelSemHash = `Pedido ${o.codigo || o.id.slice(0,8)}`
      return !transacoesPedidoDescricoes.has(labelComHash) && !transacoesPedidoDescricoes.has(labelSemHash)
    }).map(o => ({
      date:o.created_at,
      label:`Pedido #${o.codigo || o.id.slice(0,8)}`,
      value:Number(o.valor_total),
      kind:'entrada' as const,
      pago:o.pago,
      status:o.status
    })),
    // 3) Despesas como saída
    ...expenses.map(e=>({
      date:e.created_at,
      label:e.nome,
      value:-Number(e.valor),
      kind:'saída' as const,
      pago:e.pago,
      status:null
    }))
  ].sort((a,b)=>+new Date(b.date)-+new Date(a.date))

  return <MerchantDisclosure title="Movimentações" className="wd-finance-movements"><section className="glass p-5">
    <div className="flex justify-between items-center mb-4">
      <h2 className="font-semibold">Fluxo de caixa</h2>
      <button onClick={onNewTransaction} className="btn-primary flex items-center gap-1 text-sm">
        <Plus size={14}/> Lançar transação
      </button>
    </div>
    {rows.length?
      <div className="space-y-1">
        {rows.slice(0,100).map((r,i)=>(
          <div key={`${r.kind}-${i}`} className="flex justify-between items-center border-b py-3 hover:bg-gray-50 -mx-4 px-4">
            <div className="flex items-center gap-2">
              {r.kind==='entrada'?
                <ArrowUpRight className="w-4 h-4 text-green-600"/>:
                <ArrowDownRight className="w-4 h-4 text-red-600"/>
              }
              <div>
                <span className="font-medium">{r.label}</span>
                <small className="block hint">{(r.date.length === 10 ? new Date(`${r.date}T12:00:00`) : new Date(r.date)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small>
              </div>
            </div>
            <div className="text-right">
              <b className={r.value>=0?'text-green-700':'text-red-700'}>{formatCurrency(r.value)}</b>
              {r.pago===false && <span className="block text-xs text-red-500">Pendente</span>}
            </div>
          </div>
        ))}
      </div>:
      <Empty text="Sem lançamentos para exibir."/>
    }
  </section></MerchantDisclosure>
}

function Accounts({orders,expenses,onNewExpense}:{orders:Order[];expenses:Expense[];onNewExpense:()=>void}){
  return <div className="grid md:grid-cols-1 gap-4">
    <section className="glass p-5">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold">Contas a pagar</h2>
        <button onClick={onNewExpense} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          <Plus size={12}/> Nova conta
        </button>
      </div>
      {expenses.length?expenses.map(e=>(
        <div key={e.id} className="border-b py-3 flex justify-between items-center">
          <div>
            <span className="font-medium">{e.nome}</span>
            <small className="block hint">dia {e.dia_vencimento||'—'} · {e.recorrencia||'única'}</small>
          </div>
          <div className="text-right">
            <b>{formatCurrency(Number(e.valor))}</b>
            {e.pago && <span className="block text-xs text-green-600">Pago ✓</span>}
          </div>
        </div>
      )):<Empty text="Nenhuma despesa cadastrada."/>}
    </section>
  </div>
}

function Payments({tenant,onSaved}:{tenant:any;onSaved:(v:any)=>void}){
  const { error: toastError, success: toastSuccess } = useToast()
  // Defaults: todas as formas de pagamento ATIVADAS por padrão
  const DEFAULT_FORMAS = {dinheiro:true,pix:true,cartao_credito:true,cartao_debito:true}
  // Sincronizar estado inicial com a config salva, usando defaults se vazio
  const configSalva = tenant?.config?.formas_pagamento_aceitas
  const initial=configSalva && Object.keys(configSalva).length>0 ? configSalva : DEFAULT_FORMAS
  const[values,setValues]=useState<Record<string,boolean>>(initial)
  const[hasChanges,setHasChanges]=useState(false)

  // Sincronizar quando tenant mudar
  useEffect(()=>{
    const cfg=tenant?.config?.formas_pagamento_aceitas
    const cfgFinal=cfg && Object.keys(cfg).length>0 ? cfg : DEFAULT_FORMAS
    setValues(cfgFinal)
    setHasChanges(false)
  },[tenant])

  async function save(){
    if(!hasChanges)return
    const response=await fetch('/api/financeiro',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({formas:values})})
    const body=await response.json()
    if(response.ok){onSaved(body.tenant);setHasChanges(false);toastSuccess('Formas de pagamento salvas')}
    else toastError('Nao foi possivel salvar', body.error)
  }

  const toggleValue=(key:string)=>{
    setValues(v=>({...v,[key]:!v[key]}))
    setHasChanges(true)
  }

  return <section className="glass p-5">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="font-semibold">Formas aceitas no cardápio</h2>
        <p className="hint text-sm">Ative ou desative as formas de pagamento disponíveis para seus clientes.</p>
      </div>
      {hasChanges && (
        <span className="text-sm text-amber-600 font-medium">⚠️ Não salvo</span>
      )}
    </div>
    <div className="space-y-3">
      {[['dinheiro','Dinheiro','Pagamento em espécie na entrega'],['pix','PIX','Transferência instantânea'],['cartao_credito','Cartão de Crédito','Máquina na entrega'],['cartao_debito','Cartão de Débito','Máquina na entrega']].map(([id,label,desc])=>(
        <div key={id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
          <div>
            <span className="font-medium">{label}</span>
            <small className="block hint">{desc}</small>
          </div>
          <button
            onClick={()=>toggleValue(id as string)}
            className={`relative w-12 h-7 rounded-full transition-colors ${values[id as string]?'bg-green-500':'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${values[id as string]?'right-1':'left-1'}`}/>
          </button>
        </div>
      ))}
    </div>
    <button
      onClick={save}
      disabled={!hasChanges}
      className={`mt-4 w-full justify-center flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
        hasChanges
          ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
          : 'bg-gray-100 text-gray-500 cursor-not-allowed'
      }`}
    >
      {hasChanges ? '💾 Salvar alterações' : '✓ Salvo'}
    </button>
  </section>
}

function LancarModal({onClose,onSave}:{onClose:()=>void;onSave:()=>void}){
  const { error: toastError, success: toastSuccess } = useToast()
  const[forma,setForma]=useState<'entrada'|'saida'>('entrada')
  const[tipo,setTipo]=useState('manual')
  const[descricao,setDescricao]=useState('')
  const[valor,setValor]=useState('')
  const[data,setData]=useState(new Date().toISOString().split('T')[0])
  const[saving,setSaving]=useState(false)

  const salvar=async()=>{
    if(!descricao.trim()||!valor){toastError('Preencha descricao e valor');return}
    setSaving(true)
    try{
      const response = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: forma,
          categoria: tipo,
          descricao: descricao.trim(),
          valor: parseFloat(valor),
          data,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Erro ao salvar')
      onSave()
      toastSuccess('Lancamento salvo')
    }catch(e:any){toastError(e.message || 'Erro ao salvar')}
    finally{setSaving(false)}
  }

  return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Lançar transação</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20}/></button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={()=>setForma('entrada')} className={`p-3 rounded-xl border-2 font-medium transition ${forma==='entrada'?'border-green-500 bg-green-50 text-green-700':'border-gray-200'}`}>
              <ArrowUpRight className="w-5 h-5 mx-auto mb-1"/>Entrada
            </button>
            <button onClick={()=>setForma('saida')} className={`p-3 rounded-xl border-2 font-medium transition ${forma==='saida'?'border-red-500 bg-red-50 text-red-700':'border-gray-200'}`}>
              <ArrowDownRight className="w-5 h-5 mx-auto mb-1"/>Saída
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Categoria</label>
          <select value={tipo} onChange={e=>setTipo(e.target.value)} className="form-input w-full">
            <option value="manual">Lançamento manual</option>
            <option value="recebimento">Recebimento</option>
            <option value="fornecedor">Fornecedor</option>
            <option value="despesa">Despesa</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Descrição</label>
          <input value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Ex: Pagamento fornecedor, venda balcão..." className="form-input w-full"/>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Valor (R$)</label>
          <input type="number" step="0.01" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00" className="form-input w-full text-xl"/>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Data</label>
          <input type="date" value={data} onChange={e=>setData(e.target.value)} className="form-input w-full"/>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
        <button onClick={salvar} disabled={saving} className="btn-primary flex-1 justify-center">
          {saving?'Salvando...':'Salvar'}
        </button>
      </div>
    </div>
  </div>
}


function MobileFinance(){
 const [tab,setTab]=useState<Tab>('cashflow'),[range,setRange]=useState(currentMonthRange),[summary,setSummary]=useState<any>(null),[error,setError]=useState(''),[version,setVersion]=useState(0),[transaction,setTransaction]=useState(false),[account,setAccount]=useState(false)
 const refresh=()=>setVersion(x=>x+1)
 useEffect(()=>{const controller=new AbortController();setSummary(null);setError('');const query=new URLSearchParams({...range,view:'resumo'});fetch('/api/financeiro?'+query,{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error);return body}).then(setSummary).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[range.from,range.to,version])
 // Reset the default period after a month rollover; a chosen custom range remains selected.
 const defaultPeriod=useRef(true)
 useEffect(()=>{const timer=setInterval(()=>{if(defaultPeriod.current)setRange(previous=>{const next=currentMonthRange();return previous.from===next.from&&previous.to===next.to?previous:next})},30000);return()=>clearInterval(timer)},[])
 return <div className="wd-finance-page space-y-5">
  <header className="wd-page-heading"><h1 className="text-3xl font-semibold">Financeiro</h1><p>Seu dinheiro, sem complicação</p></header>
  <MerchantDateRange {...range} onApply={value=>{defaultPeriod.current=false;setRange(value)}}/><button type="button" className="text-sm text-green-700" onClick={()=>{defaultPeriod.current=true;setRange(currentMonthRange())}}>Mês atual</button>
  {error?<p role="alert">{error} <button onClick={refresh}>Tentar novamente</button></p>:!summary?<p role="status">Carregando…</p>:<div className="wd-finance-summary"><section className="wd-sales"><div className="wd-sales-top">Recebido no período</div><strong className="wd-total">{formatCurrency(summary.received)}</strong><p>Pedidos do período marcados como pagos</p></section><div className="wd-finance-metrics"><div className="wd-metric"><span>Contas a receber</span><b>{formatCurrency(summary.receivable)}</b></div><div className="wd-metric"><span>Saldo do período</span><b>{formatCurrency(summary.balance)}</b></div></div></div>}
  <button type="button" className="wd-action wd-primary" onClick={()=>setTransaction(true)}><Plus size={18}/>Lançar movimentação</button>
  <div className="wd-finance-tabs grid grid-cols-3 gap-2">{tabs.map(([id,label,Icon])=><button type="button" key={id} onClick={()=>setTab(id)} className={`glass-soft rounded-2xl p-3 text-center ${tab===id?'ring-2 ring-green-500':''}`}><Icon size={18} className="mx-auto"/><span className="block text-xs font-semibold mt-2">{label}</span></button>)}</div>
  {tab==='cashflow'?<MerchantDisclosure title="Movimentações" initiallyOpen><FinanceRecords key={`fluxo:${range.from}:${range.to}`} view="fluxo" range={range} version={version} refresh={refresh}/></MerchantDisclosure>:tab==='accounts'?<><section className="glass p-4 space-y-3"><h2 className="font-semibold">Contas a receber</h2><p className="text-sm text-gray-500">Somente contas cadastradas manualmente. Período por vencimento.</p><button className="btn-primary" onClick={()=>setAccount(true)}><Plus size={16}/>Cadastrar conta a receber</button><FinanceRecords key={`receber:${range.from}:${range.to}`} view="receber" range={range} version={version} refresh={refresh}/></section><section className="glass p-4"><h2 className="font-semibold">Contas a pagar</h2><FinanceRecords key={`despesas:${range.from}:${range.to}`} view="despesas" range={range} version={version} refresh={refresh}/></section></>:summary?<Payments tenant={summary.tenant} onSaved={tenant=>setSummary((previous:any)=>({...previous,tenant}))}/>:null}
  {transaction?<LancarModal onClose={()=>setTransaction(false)} onSave={()=>{setTransaction(false);refresh()}}/>:null}
  {account?<ReceivableModal onClose={()=>setAccount(false)} onSave={()=>{setAccount(false);refresh()}}/>:null}
 </div>
}
function FinanceRecords({view,range,version,refresh}:{view:string;range:{from:string;to:string};version:number;refresh:()=>void}){
 const [page,setPage]=useState(0),[data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false)
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');fetch('/api/financeiro?'+new URLSearchParams({...range,view,offset:String(page*50)}),{cache:'no-store',signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error);return body}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[view,range.from,range.to,page,version])
 async function receive(id:string){if(lock.current||!window.confirm('Confirmar recebimento? O valor entrará no fluxo de caixa.'))return;lock.current=true;setBusy(true);setError('');try{const response=await fetch('/api/contas-receber',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const body=await response.json();if(!response.ok)throw Error(body.error);setPage(0);refresh()}catch(e:any){setError(e.message)}finally{lock.current=false;setBusy(false)}}
 return <div>{error?<p role="alert">{error} <button onClick={refresh}>Atualizar</button></p>:null}{!data&&!error?<p role="status">Carregando…</p>:data?.rows.length?data.rows.map((row:any)=><div key={row.id} className="border-b py-3 flex justify-between items-center gap-3"><div className="min-w-0"><b className="text-sm">{row.descricao||row.nome}</b>{row.data?<small className="block text-gray-500">{new Date(row.data.length===10?row.data+'T12:00:00':row.data).toLocaleDateString('pt-BR')}{row.tipo?' · '+row.tipo:''}</small>:null}</div><div className="text-right shrink-0"><b className={Number(row.amount??row.valor)<0?'text-red-600':'text-green-700'}>{formatCurrency(Number(row.amount??row.valor))}</b>{view==='receber'?<button disabled={busy} className="block text-sm text-green-700 py-2" onClick={()=>void receive(row.id)}>Receber</button>:null}</div></div>):data?<p className="text-sm py-5 text-gray-500">{view==='receber'?'Nenhuma conta a receber.':view==='despesas'?'Nenhuma despesa cadastrada.':'Nenhuma movimentação neste período.'}</p>:null}{page>0||data?.hasMore?<div className="flex justify-between py-3"><button disabled={!page} onClick={()=>setPage(x=>x-1)}>Anterior</button><span>{page+1}</span><button disabled={!data?.hasMore} onClick={()=>setPage(x=>x+1)}>Próxima</button></div>:null}</div>
}
function ReceivableModal({onClose,onSave}:{onClose:()=>void;onSave:()=>void}){
 const [description,setDescription]=useState(''),[value,setValue]=useState(''),[due,setDue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false)
 async function save(event:React.FormEvent){event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const response=await fetch('/api/contas-receber',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({descricao:description,valor:Number(value.replace(',','.')),vencimento:due})});const body=await response.json();if(!response.ok)throw Error(body.error);onSave()}catch(e:any){setError(e.message)}finally{lock.current=false;setBusy(false)}}
 return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><form onSubmit={save} role="dialog" aria-modal="true" aria-label="Nova conta a receber" className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4"><h2 className="text-xl font-semibold">Nova conta a receber</h2>{error?<p role="alert">{error}</p>:null}<label className="block">Descrição<input required maxLength={500} className="form-input w-full" value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="block">Valor (R$)<input required type="number" step="0.01" min="0.01" className="form-input w-full" value={value} onChange={e=>setValue(e.target.value)}/></label><label className="block">Vencimento<input required type="date" className="form-input w-full" value={due} onChange={e=>setDue(e.target.value)}/></label><div className="flex gap-3"><button type="button" disabled={busy} className="btn-secondary flex-1" onClick={onClose}>Cancelar</button><button disabled={busy} className="btn-primary flex-1">{busy?'Salvando…':'Cadastrar conta'}</button></div></form></div>
}
