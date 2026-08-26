'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WalletCards, Receipt, CreditCard, Plus, X, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Tab = 'cashflow'|'accounts'|'payments'
type Order = { id:string; codigo:string|null; created_at:string; valor_total:number; taxa_entrega:number; forma_pagamento:string; status:string; pago:boolean|null }
type Expense = { id:string; nome:string; valor:number; dia_vencimento?:number|null; recorrencia?:string|null; created_at:string; pago:boolean|null }
type ManualTransaction = { id:string; tipo:'entrada'|'saida'; descricao:string; valor:number; data:string; categoria:string }

const tabs = [
  ['cashflow','Fluxo de caixa',WalletCards],
  ['accounts','Contas a pagar/receber',Receipt],
  ['payments','Formas de pagamento',CreditCard],
] as const

export default function FinanceiroPage(){
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
      // Calcular saldo total - SÓ conta pedidos PAGOS como entrada
      const entradas = (body.orders||[]).filter((o:any)=>o.pago===true && o.status!=='cancelado').reduce((s:number,o:any)=>s+Number(o.valor_total||0),0)
      const saidas = (body.expenses||[]).reduce((s:number,e:any)=>s+Number(e.valor||0),0)
      const manual = (body.transactions||[]).reduce((s:number,t:any)=>s+(t.tipo==='entrada'?1:-1)*Number(t.valor||0),0)
      setSaldoTotal(entradas - saidas + manual)
    }finally{setLoading(false)}
  })()},[])

  if(loading)return <div className="hint p-8">Carregando dados financeiros…</div>

  return <div className="space-y-5">
    <header>
      <div className="eyebrow mb-2">Financeiro</div>
      <h1 className="text-3xl font-semibold">Gestão financeira</h1>
      <div className="flex items-center gap-4 mt-2">
        <span className={`text-2xl font-bold ${saldoTotal>=0?'text-green-600':'text-red-600'}`}>
          Saldo: {formatCurrency(saldoTotal)}
        </span>
        <span className={`text-sm ${saldoTotal>=0?'text-green-500':'text-red-500'}`}>
          {saldoTotal>=0?'▲ Positivo':'▼ Negativo'}
        </span>
      </div>
    </header>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
  // Só mostra PEDIDOS PAGOS como entrada no fluxo de caixa
  const rows=[
    ...orders.filter(o=>o.pago===true).map(o=>({
      date:o.created_at,
      label:`Pedido ${o.codigo || `#${o.id.slice(0,8)}`}`,
      value:Number(o.valor_total),
      kind:'entrada' as const,
      pago:o.pago,
      status:o.status
    })),
    ...expenses.map(e=>({
      date:e.created_at,
      label:e.nome,
      value:-Number(e.valor),
      kind:'saída' as const,
      pago:e.pago,
      status:null
    })),
    ...transactions.map(t=>({
      date:t.data,
      label:t.descricao,
      value:t.tipo==='entrada'?Number(t.valor):-Number(t.valor),
      kind:t.tipo as 'entrada' | 'saida',
      pago:null as null,
      status:null as null
    }))
  ].sort((a,b)=>+new Date(b.date)-+new Date(a.date))

  return <section className="glass p-5">
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
                <small className="block hint">{new Date(r.date).toLocaleDateString('pt-BR')}</small>
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
  </section>
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
    if(response.ok){onSaved(body.tenant);setHasChanges(false);alert('Formas de pagamento salvas.')}
    else alert(body.error||'Não foi possível salvar.')
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
  const[forma,setForma]=useState<'entrada'|'saida'>('entrada')
  const[tipo,setTipo]=useState('manual')
  const[descricao,setDescricao]=useState('')
  const[valor,setValor]=useState('')
  const[data,setData]=useState(new Date().toISOString().split('T')[0])
  const[saving,setSaving]=useState(false)
  const supabase=createClient()

  const salvar=async()=>{
    if(!descricao.trim()||!valor){alert('Preencha descrição e valor');return}
    setSaving(true)
    try{
      const tenantId=await fetch('/api/auth/meu-tenant').then(r=>r.json()).then(d=>d.tenantId)
      const {error}=await supabase.from('movimentacoes_financeiras').insert({
        tenant_id:tenantId,
        tipo:forma,
        categoria:tipo,
        descricao:descricao.trim(),
        valor:parseFloat(valor),
        data
      })
      if(error)throw error
      onSave()
    }catch(e:any){alert(e.message||'Erro ao salvar')}
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
