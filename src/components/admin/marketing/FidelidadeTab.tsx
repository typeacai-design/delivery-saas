'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Coins, Save, Clock, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type CashbackConfig = { cashback_ativo: boolean; cashback_tipo: 'percentual' | 'fixo_por_real'; cashback_percent: number; cashback_valor_por_real: number; cashback_validade_dias: number | null }
const initial: CashbackConfig = { cashback_ativo: false, cashback_tipo: 'percentual', cashback_percent: 5, cashback_valor_por_real: 0.05, cashback_validade_dias: 30 }
export default function FidelidadeTab() {
  const [config,setConfig]=useState<CashbackConfig>(initial)
  const [salvando,setSalvando]=useState(false)
  const [carregando,setCarregando]=useState(true)
  const [mensagem,setMensagem]=useState('')
  const [clientes,setClientes]=useState<any[]>([])
  const [busca,setBusca]=useState('')
  const supabase=createClient()
  const tenantId=async()=>{const r=await fetch('/api/auth/session',{cache:'no-store'});const b=await r.json();return r.ok?b.tenant?.id:null}
  useEffect(()=>{void carregar()},[])
  async function carregar(){
    setCarregando(true)
    const tid=await tenantId()
    if(!tid){setMensagem('Não foi possível identificar a loja');setCarregando(false);return}
    const [{data:tenant,error:te},{data:lista,error:ce}]=await Promise.all([
      supabase.from('tenants').select('config').eq('id',tid).single(),
      supabase.from('clientes').select('id,nome,telefone,saldo_cashback').eq('tenant_id',tid).eq('ativo',true).order('nome')
    ])
    if(te||ce)setMensagem('Não foi possível carregar todos os dados')
    const cfg=tenant?.config||{}
    setConfig({cashback_ativo:cfg.cashback_ativo===true,cashback_tipo:cfg.cashback_tipo==='fixo_por_real'?'fixo_por_real':'percentual',cashback_percent:Number(cfg.cashback_percent??5),cashback_valor_por_real:Number(cfg.cashback_valor_por_real??0.05),cashback_validade_dias:cfg.cashback_validade_dias===null?null:Number(cfg.cashback_validade_dias??30)})
    setClientes(lista||[])
    setCarregando(false)
  }
  async function salvar(){
    const valor=config.cashback_tipo==='percentual'?config.cashback_percent:config.cashback_valor_por_real
    if(!Number.isFinite(valor)||valor<0||(config.cashback_tipo==='percentual'&&valor>100)||(config.cashback_tipo==='fixo_por_real'&&valor>1)){setMensagem('Informe uma recompensa válida (até 100% do pedido)');return}
    setSalvando(true);setMensagem('')
    const tid=await tenantId()
    if(!tid){setMensagem('Loja não identificada');setSalvando(false);return}
    const {data:tenant,error:readError}=await supabase.from('tenants').select('config').eq('id',tid).single()
    if(readError){setMensagem('Erro ao carregar configuração atual');setSalvando(false);return}
    const {error}=await supabase.from('tenants').update({config:{...(tenant?.config||{}),...config,fidelidade_ativo:false,fidelidade_tipo:'desativado',pontos_por_real:0}}).eq('id',tid)
    setMensagem(error?'Não foi possível salvar: '+error.message:'Configurações de cashback salvas!')
    setSalvando(false)
  }
  const exemplo=100*(config.cashback_tipo==='percentual'?config.cashback_percent/100:config.cashback_valor_por_real)
  return <div className="space-y-5">
    <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-start gap-3"><div className="bg-green-100 text-green-700 p-3 rounded-xl"><Coins size={22}/></div><div><h2 className="text-lg font-bold text-gray-900">Programa de cashback</h2><p className="text-sm text-gray-500">Recompense clientes em reais a cada compra paga. A taxa de entrega entra no cálculo.</p></div></div>
      <label className="flex justify-between items-center gap-3 border rounded-xl p-4"><div><div className="font-semibold text-gray-900">Ativar cashback</div><p className="text-xs text-gray-500">O cliente poderá acumular e utilizar créditos em compras futuras</p></div><input type="checkbox" checked={config.cashback_ativo} onChange={e=>setConfig({...config,cashback_ativo:e.target.checked})} className="size-5 accent-green-600"/></label>
      {config.cashback_ativo&&<div className="space-y-4">
        <div><label className="text-sm font-semibold block mb-2">Como calcular a recompensa?</label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={()=>setConfig({...config,cashback_tipo:'percentual'})} className={`text-left p-4 rounded-xl border-2 ${config.cashback_tipo==='percentual'?'border-green-600 bg-green-50':'border-gray-200'}`}><strong>Porcentagem (%)</strong><p className="text-xs text-gray-500 mt-1">Ex.: 5% do valor total pago</p></button>
          <button type="button" onClick={()=>setConfig({...config,cashback_tipo:'fixo_por_real'})} className={`text-left p-4 rounded-xl border-2 ${config.cashback_tipo==='fixo_por_real'?'border-green-600 bg-green-50':'border-gray-200'}`}><strong>Valor por R$ 1</strong><p className="text-xs text-gray-500 mt-1">Ex.: R$ 0,05 para cada R$ 1 gasto</p></button>
        </div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-sm font-semibold">Valor da recompensa<input className="form-input w-full mt-2" type="number" min="0" max={config.cashback_tipo==='percentual'?'100':'1'} step="0.01" value={config.cashback_tipo==='percentual'?config.cashback_percent:config.cashback_valor_por_real} onChange={e=>setConfig({...config,[config.cashback_tipo==='percentual'?'cashback_percent':'cashback_valor_por_real']:Number(e.target.value)})}/><span className="text-xs text-gray-500">{config.cashback_tipo==='percentual'?'Percentual do pedido':'Reais de cashback por real gasto'}</span></label>
        <label className="text-sm font-semibold">Validade dos créditos<select className="form-input w-full mt-2" value={config.cashback_validade_dias??'sem'} onChange={e=>setConfig({...config,cashback_validade_dias:e.target.value==='sem'?null:Number(e.target.value)})}>{[7,15,30,60,90,180,365].map(d=><option key={d} value={d}>{d} dias</option>)}<option value="sem">Sem vencimento</option></select><span className="text-xs text-gray-500">Contados a partir do crédito após pagamento</span></label></div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4"><p className="text-xs text-green-900">Exemplo em pedido de R$ 100,00, incluindo entrega</p><p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(exemplo)} de cashback</p></div>
      </div>}
      <button type="button" disabled={salvando||carregando} onClick={salvar} className="btn-primary"><Save size={16}/>{salvando?'Salvando...':'Salvar configurações'}</button>
      {mensagem&&<p role="status" className="text-sm text-gray-700">{mensagem}</p>}
    </section>
    <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-3">
      <div className="flex items-center gap-2"><Wallet className="text-green-700" size={20}/><h3 className="font-bold text-gray-900">Saldo de cashback por cliente</h3></div>
      <p className="text-sm text-gray-500">Consulte o saldo atual de cada cliente da sua loja.</p>
      <input className="form-input w-full" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome ou telefone"/>
      <div className="max-h-96 overflow-y-auto divide-y">{clientes.filter(c=>(c.nome||'').toLowerCase().includes(busca.toLowerCase())||(c.telefone||'').includes(busca)).map(c=><div key={c.id} className="py-3 flex justify-between items-center gap-3"><div className="min-w-0"><div className="font-semibold text-sm truncate">{c.nome}</div><div className="text-xs text-gray-500">{c.telefone}</div></div><div className="font-bold text-green-700 whitespace-nowrap">{formatCurrency(Number(c.saldo_cashback)||0)}</div></div>)}</div>
    </section>
  </div>
}
