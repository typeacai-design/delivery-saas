export const BRASILIA = 'America/Sao_Paulo'
export function brasiliaDay(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA',{timeZone:BRASILIA,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const get=(key:string)=>p.find(x=>x.type===key)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function civilDayShift(day:string, amount:number) {
  const d=new Date(day+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+amount); return d.toISOString().slice(0,10)
}
export function validCivilDay(day:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day+'T12:00:00Z')) && civilDayShift(day,0)===day
}
export function brasiliaBounds(from:string,to:string) {
  if(!validCivilDay(from)||!validCivilDay(to)||from>to) throw Error('Período inválido')
  return {start:brasiliaInstant(from).toISOString(),end:brasiliaInstant(civilDayShift(to,1)).toISOString()}
}
export function brasiliaWall(now=new Date()) {
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:BRASILIA,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now)
 const n=(k:string)=>Number(p.find(x=>x.type===k)!.value)
 return new Date(Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second')))
}
export function brasiliaInstant(day:string,minutes=0){
 const desired=Date.parse(day+'T00:00:00Z')+minutes*60000
 let value=desired+3*3600000
 for(let i=0;i<3;i++){const delta=desired-brasiliaWall(new Date(value)).getTime();if(!delta)break;value+=delta}
 return new Date(value)
}
export function formatBrasilia(value:string|Date,kind:'date'|'time'|'datetime'='date',options:Intl.DateTimeFormatOptions={}){
 const civil=typeof value==='string'?value.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?)?$/):null
 const d=civil?brasiliaInstant(civil[1],civil[2]?Number(civil[2])*60+Number(civil[3]):720):new Date(value)
 const opts={...options,timeZone:BRASILIA}
 return kind==='time'?d.toLocaleTimeString('pt-BR',opts):kind==='datetime'?d.toLocaleString('pt-BR',opts):d.toLocaleDateString('pt-BR',opts)
}
export function reportDefault(now=new Date()) { const to=brasiliaDay(now);return {from:to.slice(0,8)+'01',to} }
export function civilLabel(day:string) { return day.split('-').reverse().join('/') }
