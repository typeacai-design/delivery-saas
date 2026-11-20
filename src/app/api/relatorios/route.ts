import { authenticatedTenant, MANAGEMENT_ROLES, tenantAuthStatus } from '@/lib/tenant-auth'
import { createClient } from '@supabase/supabase-js'
import { brasiliaBounds, reportDefault } from '@/lib/brasilia'
import { buildReports, type ReportFilters } from '@/lib/merchant-reports'
import { reportWorkbook } from '@/lib/report-workbook'

const PAGE=250
async function allRows(make:(from:number,to:number)=>PromiseLike<{data:any[]|null;error:any}>){
 const result:any[]=[];for(let n=0;;n+=PAGE){const {data,error}=await make(n,n+PAGE-1);if(error)throw error;result.push(...(data||[]));if(!data||data.length<PAGE)return result}
}
const orderCols='id,valor_total,data_criacao,status,forma_pagamento,valor_pago,pago,tipo_pedido,tipo_entrega,sessao_mesa_id,motivo_cancelamento,cancelado_em,deleted_at'
export async function GET(request:Request){
 const auth=await authenticatedTenant(MANAGEMENT_ROLES)
 if(!auth.tenantId)return Response.json({error:'Acesso indisponível.'},{status:tenantAuthStatus(auth)??403})
 const tenantId=auth.tenantId, query=new URL(request.url).searchParams, defaults=reportDefault()
 const f:ReportFilters={from:query.get('from')||defaults.from,to:query.get('to')||defaults.to,status:query.get('status')||'',payment:query.get('payment')||'',visits:query.get('visits')||'7d'}
 let bounds
 try{bounds=brasiliaBounds(f.from,f.to);if(!['','novo','preparando','pronto','saiu','entregue','cancelado'].includes(f.status)||!['','dinheiro','pix','cartao_credito','cartao_debito','nao_informado','misto'].includes(f.payment)||!['24h','7d','30d','all'].includes(f.visits))throw Error()}catch{return Response.json({error:'Filtros inválidos.'},{status:400})}
 try{
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
  const {start,end}=bounds
  const viewSince=f.visits==='all'?'2000-01-01T00:00:00Z':new Date(Date.now()-({'24h':1,'7d':7,'30d':30}[f.visits as '24h'|'7d'|'30d'])*86400000).toISOString()
  const [orders,sessions,movements,expenses,visits]=await Promise.all([
   allRows((a,b)=>admin.from('pedidos').select(orderCols).eq('tenant_id',tenantId).is('deleted_at',null).or(`and(data_criacao.gte.${start},data_criacao.lt.${end}),and(cancelado_em.gte.${start},cancelado_em.lt.${end})`).order('id').range(a,b)),
   allRows((a,b)=>admin.from('sessoes_mesa').select('id,valor_total,forma_pagamento,data_fechamento,status').eq('tenant_id',tenantId).eq('status','fechada').gte('data_fechamento',start).lt('data_fechamento',end).order('id').range(a,b)),
   allRows((a,b)=>admin.from('movimentacoes_financeiras').select('id,tipo,valor,data,referencia_id,categoria,forma_pagamento').eq('tenant_id',tenantId).gte('data',f.from).lte('data',f.to).order('id').range(a,b)),
   allRows((a,b)=>admin.from('despesas').select('id,valor,created_at').eq('tenant_id',tenantId).gte('created_at',start).lt('created_at',end).order('id').range(a,b)),
   allRows((a,b)=>admin.from('page_views').select('id,created_at').eq('tenant_id',tenantId).gte('created_at',viewSince).order('id').range(a,b))
  ])
  const orderMap=new Map(orders.map(o=>[o.id,o]))
  for(let i=0;i<sessions.length;i+=100){const ids=sessions.slice(i,i+100).map(s=>s.id);const linked=await allRows((a,b)=>admin.from('pedidos').select(orderCols).eq('tenant_id',tenantId).is('deleted_at',null).in('sessao_mesa_id',ids).order('id').range(a,b));for(const o of linked)orderMap.set(o.id,o)}
  const ids=[...orderMap.values()].filter(o=>o.status!=='cancelado').map(o=>o.id),items:any[]=[]
  for(let i=0;i<ids.length;i+=100)items.push(...await allRows((a,b)=>admin.from('pedido_itens').select('id,pedido_id,nome,quantidade,valor_unitario,complementos,pedido_complementos(nome,quantidade,valor)').in('pedido_id',ids.slice(i,i+100)).order('id').range(a,b)))
  const result=buildReports(f,[...orderMap.values()],sessions,items,movements,expenses,visits)
  return Response.json({...result,workbookBase64:Buffer.from(reportWorkbook(result)).toString('base64')},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){console.error('reports_read_failed',error);return Response.json({error:'Não foi possível carregar os relatórios.'},{status:500})}
}
