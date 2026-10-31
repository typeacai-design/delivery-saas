type Sale={valor_total:number|string;pago:boolean;status:string;forma_pagamento:unknown;data_criacao:string}
export function homeSummary(rows:Sale[],day:string){
 const active=rows.filter(o=>o.status!=='cancelado'),today=active.filter(o=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(o.data_criacao))===day)
 // Match the website's current dashboard revenue predicate exactly.
 const paid=(o:Sale)=>o.pago===true||(o.status==='entregue'&&o.forma_pagamento==='dinheiro')
 const paidMonth=active.filter(paid),paidToday=today.filter(paid)
 return {totalToday:paidToday.reduce((s,o)=>s+Number(o.valor_total||0),0),paidToday:paidToday.length,totalMonth:paidMonth.reduce((s,o)=>s+Number(o.valor_total||0),0),paidMonth:paidMonth.length,fresh:today.filter(o=>o.status==='novo').length,ongoing:today.filter(o=>['novo','preparando','pronto','saiu'].includes(o.status)).length}
}
