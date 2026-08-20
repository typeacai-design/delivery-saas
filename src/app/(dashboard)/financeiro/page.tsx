'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WalletCards, Receipt, CreditCard, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Tab = 'cashflow'|'accounts'|'payments'|'reports'
type Order = { id:string; created_at:string; valor_total:number; taxa_entrega:number; forma_pagamento:string; status:string }
type Expense = { id:string; nome:string; valor:number; dia_vencimento?:number|null; recorrencia?:string|null; created_at:string }
type TenantFinance = { id:string; config:Record<string,unknown> }
const tabs = [
  ['cashflow','Fluxo de caixa',WalletCards],['accounts','Contas a pagar/receber',Receipt],
  ['payments','Formas de pagamento',CreditCard],['reports','Relatórios',FileText],
] as const

export default function FinanceiroPage(){
  const supabase=useMemo(()=>createClient(),[]); const[tab,setTab]=useState<Tab>('cashflow'); const[orders,setOrders]=useState<Order[]>([]); const[expenses,setExpenses]=useState<Expense[]>([]); const[tenant,setTenant]=useState<TenantFinance|null>(null); const[loading,setLoading]=useState(true)
  useEffect(()=>{(async()=>{try{const response=await fetch('/api/financeiro',{cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error);setOrders(body.orders||[]);setExpenses(body.expenses||[]);setTenant(body.tenant)}finally{setLoading(false)}})()},[])
  const validOrders=orders.filter(o=>o.status!=='cancelado')
  if(loading)return <div className="hint p-8">Carregando dados financeiros…</div>
  return <div className="space-y-5">
    <header>
      <div className="eyebrow mb-2">Financeiro</div>
      <h1 className="text-3xl font-semibold">Gestão financeira</h1>
      <p className="hint mt-1">Fluxo de caixa, contas, formas de pagamento e relatórios.</p>
    </header>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`glass-soft min-h-24 rounded-2xl p-4 text-left transition ${tab===id?'ring-2 ring-green-500':''}`}><Icon size={18}/><span className="block text-sm font-semibold mt-2">{label}</span></button>)}
    </div>
    {tab==='cashflow'&&<CashFlow orders={validOrders} expenses={expenses}/>}
    {tab==='accounts'&&<Accounts orders={validOrders} expenses={expenses}/>}
    {tab==='payments'&&<Payments tenant={tenant} onSaved={setTenant}/>}
    {tab==='reports'&&<Reports orders={validOrders} revenue={validOrders.reduce((s,o)=>s+Number(o.valor_total||0),0)} expenses={expenses.reduce((s,e)=>s+Number(e.valor||0),0)}/>}
  </div>
}

const Empty=({text}:{text:string})=><p className="hint text-sm py-8 text-center">{text}</p>

function CashFlow({orders,expenses}:{orders:Order[];expenses:any[]}){
  const rows=[
    ...orders.map(o=>({date:o.created_at,label:`Pedido ${o.id.slice(0,8)}`,value:Number(o.valor_total),kind:'entrada' as const})),
    ...expenses.map(e=>({date:e.created_at,label:e.nome,value:-Number(e.valor),kind:'saída' as const}))
  ].sort((a,b)=>+new Date(b.date)-+new Date(a.date))

  return <section className="glass p-5">
    <h2 className="font-semibold mb-3">Fluxo registrado</h2>
    {rows.length?
      rows.slice(0,100).map((r,i)=><div key={`${r.kind}-${i}`} className="flex justify-between border-b py-3"><span>{r.label}<small className="block hint">{new Date(r.date).toLocaleDateString('pt-BR')}</small></span><b className={r.value>=0?'text-green-700':'text-red-700'}>{formatCurrency(r.value)}</b></div>):
      <Empty text="Sem lançamentos para exibir."/>
    }
  </section>
}

function Accounts({orders,expenses}:{orders:Order[];expenses:any[]}){
  return <div className="grid md:grid-cols-2 gap-4">
    <section className="glass p-5">
      <h2 className="font-semibold">Contas a pagar</h2>
      {expenses.length?expenses.map(e=><p key={e.id} className="border-b py-3 flex justify-between"><span>{e.nome}<small className="block hint">dia {e.dia_vencimento||'—'} · {e.recorrencia}</small></span><b>{formatCurrency(Number(e.valor))}</b></p>):<Empty text="Nenhuma despesa cadastrada."/>}
    </section>
    <section className="glass p-5">
      <h2 className="font-semibold">Valores de pedidos</h2>
      <p className="hint text-xs mb-2">Pedidos registrados; conciliação bancária não é automática.</p>
      {orders.length?orders.slice(0,30).map(o=><p key={o.id} className="border-b py-3 flex justify-between"><span>#{o.id.slice(0,8)}<small className="block hint">{o.status}</small></span><b>{formatCurrency(Number(o.valor_total))}</b></p>):<Empty text="Nenhum pedido registrado."/>}
    </section>
  </div>
}

function Payments({tenant,onSaved}:{tenant:any;onSaved:(v:any)=>void}){
  const initial=tenant?.config?.formas_pagamento_aceitas||{};
  const[values,setValues]=useState<Record<string,boolean>>(initial);
  async function save(){
    const response=await fetch('/api/financeiro',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({formas:values})});
    const body=await response.json();
    if(response.ok){onSaved({...tenant,config:body.config});alert('Formas de pagamento salvas.')}
    else alert(body.error||'Não foi possível salvar.')
  }
  return <section className="glass p-5">
    <h2 className="font-semibold mb-3">Formas aceitas no cardápio</h2>
    {[['dinheiro','Dinheiro'],['pix','Pix'],['cartao_credito','Cartão de crédito'],['cartao_debito','Cartão de débito']].map(([id,label])=>
      <label key={id} className="flex justify-between border-b py-3">
        <span>{label}</span>
        <input type="checkbox" checked={!!values[id]} onChange={()=>setValues(v=>({...v,[id]:!v[id]}))}/>
      </label>
    )}
    <button onClick={save} className="btn-primary mt-4">Salvar</button>
  </section>
}

function Reports({orders,revenue,expenses}:any){
  const byPayment=orders.reduce((a:any,o:Order)=>{
    a[o.forma_pagamento||'não informado']=(a[o.forma_pagamento||'não informado']||0)+Number(o.valor_total);
    return a
  },{});

  return <section className="glass p-5">
    <h2 className="font-semibold mb-3">Resumo do período</h2>
    <div className="grid md:grid-cols-3 gap-3 mb-5">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-xs text-green-700">Receita</p>
        <p className="text-2xl font-bold text-green-900">{formatCurrency(revenue)}</p>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-xs text-red-700">Despesas</p>
        <p className="text-2xl font-bold text-red-900">{formatCurrency(expenses)}</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700">Saldo</p>
        <p className="text-2xl font-bold text-blue-900">{formatCurrency(revenue - expenses)}</p>
      </div>
    </div>
    <div className="mt-4">
      <h3 className="font-semibold mb-3">Por forma de pagamento</h3>
      {Object.entries(byPayment).map(([k,v])=>
        <p key={k} className="flex justify-between border-b py-2"><span>{k.replaceAll('_',' ')}</span><b>{formatCurrency(Number(v))}</b></p>
      )}
    </div>
  </section>
}