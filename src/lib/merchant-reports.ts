import { BRASILIA, brasiliaDay } from './brasilia.ts'
export const reportTabs = [['periodo','Por período'],['pagamento','Por pagamento'],['item','Por item'],['complemento','Complementos'],['dias','Top dias'],['horarios','Horários de pico'],['semana','Dias da semana'],['modalidade','Modalidades'],['cancelamentos','Cancelamentos']] as const
export type ReportTab=typeof reportTabs[number][0]
export type ReportRow={nome:string;qtd:number;total:number}
export type ReportFilters={from:string;to:string;status:string;payment:string;visits:string}
export type ReportResult={filters:ReportFilters;rows:Record<ReportTab,ReportRow[]>;summary:{vendas:number;entradas:number;saidas:number;saldo:number;pedidos:number;ticket:number};visits:{total:number;porDia:{data:string;views:number}[]}}
type Row=Record<string,any>
const cents=(v:unknown)=>Math.round((Number(v)||0)*100)
const forms=(v:unknown):string[]=>Array.isArray(v)?v.filter(Boolean).map(String):v?[String(v)]:[]
function splitPayment(o:Row,amount:number) {
 const fs=forms(o.forma_pagamento)
 if(!fs.length)return [{nome:'nao_informado',valor:amount}]
 if(fs.length===1)return [{nome:fs[0],valor:amount}]
 const vs=Array.isArray(o.valor_pago)?o.valor_pago.map(Number):[]
 const sum=vs.reduce((a:number,b:number)=>a+b,0)
 if(vs.length!==fs.length||!vs.every((x:number)=>Number.isFinite(x)&&x>=0)||sum<=0)return [{nome:'misto',valor:amount}]
 let left=amount;return fs.map((nome,i)=>{const valor=i===fs.length-1?left:Math.round(amount*vs[i]/sum);left-=valor;return {nome,valor}})
}
export function buildReports(f:ReportFilters, orders:Row[], sessions:Row[], items:Row[], movements:Row[], expenses:Row[], visits:Row[]):ReportResult {
 const maps=Object.fromEntries(reportTabs.map(([id])=>[id,new Map<string,{nome:string;qtd:number;total:number}>()])) as Record<ReportTab,Map<string,{nome:string;qtd:number;total:number}>>
 const add=(tab:ReportTab,nome:string,qtd:number,valor:number)=>{const x=maps[tab].get(nome)||{nome,qtd:0,total:0};x.qtd+=qtd;x.total+=valor;maps[tab].set(nome,x)}
 const inRange=(d:string)=>!!d&&brasiliaDay(new Date(d))>=f.from&&brasiliaDay(new Date(d))<=f.to
 const paidIds=new Set<string>()
 const sessionMap=new Map(sessions.map(s=>[s.id,s]))
 let sales=0,count=0
 const sale=(row:Row,date:string,mode:string,ids:string[])=>{
  const amount=cents(row.valor_total), parts=splitPayment(row,amount)
  const selected=f.payment?parts.filter(x=>x.nome===f.payment):parts
  if(!selected.length)return
  const filtered=selected.reduce((n,x)=>n+x.valor,0)
  sales+=filtered;count++;ids.forEach(id=>paidIds.add(id))
  const d=new Date(date), day=brasiliaDay(d)
  add('periodo',day,1,filtered);add('dias',day,1,filtered)
  add('horarios',new Intl.DateTimeFormat('pt-BR',{timeZone:BRASILIA,hour:'2-digit',hourCycle:'h23'}).format(d)+'h',1,filtered)
  add('semana',new Intl.DateTimeFormat('pt-BR',{timeZone:BRASILIA,weekday:'long'}).format(d),1,filtered)
  add('modalidade',mode,1,filtered)
  selected.forEach(x=>add('pagamento',x.nome,1,x.valor))
 }
 for(const o of orders){
  if(o.deleted_at)continue
  if(o.status==='cancelado'){
   if(inRange(o.cancelado_em||o.data_criacao)&&(!f.status||f.status==='cancelado')&&(!f.payment||splitPayment(o,cents(o.valor_total)).some(x=>x.nome===f.payment)))add('cancelamentos',o.motivo_cancelamento||'Não informado',1,cents(o.valor_total))
   continue
  }
  if(o.pago!==true||o.sessao_mesa_id||!inRange(o.data_criacao)||f.status&&f.status!==o.status)continue
  sale(o,o.data_criacao,o.tipo_pedido||o.tipo_entrega||'Não informado',[o.id])
 }
 for(const s of sessionMap.values()){
  if(s.status!=='fechada'||!inRange(s.data_fechamento)||f.status&&f.status!=='entregue')continue
  const linked=orders.filter(o=>o.sessao_mesa_id===s.id&&!o.deleted_at&&o.status!=='cancelado')
  if(!linked.length&&cents(s.valor_total)===0)continue
  sale(s,s.data_fechamento,'mesa',linked.map(o=>o.id))
 }
 for(const i of items){
  if(!paidIds.has(i.pedido_id))continue
  const qty=Number(i.quantidade)||0
  add('item',i.nome||'Sem nome',qty,qty*cents(i.valor_unitario))
  let extra=i.pedido_complementos?.length?i.pedido_complementos:i.complementos
  if(typeof extra==='string'){try{extra=JSON.parse(extra)}catch{extra=[]}}
  for(const c of Array.isArray(extra)?extra:[]){const n=c.nome||c.name;if(!n)continue;const q=qty*(Number(c.quantidade)||1);add('complemento',n,q,q*cents(c.valor??c.preco))}
 }
 const nonSales=movements.filter(m=>m.tipo==='entrada'&&!['pedido','venda'].includes(m.categoria)&&!f.status&&(!f.payment||m.forma_pagamento===f.payment)).reduce((n,m)=>n+cents(m.valor),0)
 const outgoing=movements.filter(m=>m.tipo==='saida')
 const linked=new Set(outgoing.map(m=>m.referencia_id).filter(Boolean))
 const out=outgoing.reduce((n,m)=>n+cents(m.valor),0)+expenses.filter(e=>!linked.has(e.id)).reduce((n,e)=>n+cents(e.valor),0)
 const rows=Object.fromEntries(reportTabs.map(([id])=>[id,[...maps[id].values()].sort((a,b)=>id==='periodo'?a.nome.localeCompare(b.nome):b.total-a.total||a.nome.localeCompare(b.nome)).slice(0,id==='dias'?5:undefined).map(r=>({...r,total:r.total/100}))])) as ReportResult['rows']
 const viewDays=new Map<string,number>();for(const v of visits){const d=brasiliaDay(new Date(v.created_at));viewDays.set(d,(viewDays.get(d)||0)+1)}
 return {filters:f,rows,summary:{vendas:sales/100,entradas:(sales+nonSales)/100,saidas:out/100,saldo:(sales+nonSales-out)/100,pedidos:count,ticket:count?Math.round(sales/count)/100:0},visits:{total:visits.length,porDia:[...viewDays].sort().map(([data,views])=>({data,views}))}}
}
