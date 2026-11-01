import { NextResponse } from 'next/server'
import { authenticatedTenant, tenantAuthStatus } from '@/lib/tenant-auth'
export async function POST(request: Request) {
 try {
  const auth=await authenticatedTenant(['owner','manager']),status=tenantAuthStatus(auth)
  if(status)return NextResponse.json({error:'Sem permissão'},{status})
  const body=await request.json(),valor=Number(body.valor),descricao=String(body.descricao||'').trim(),vencimento=String(body.vencimento||'')
  if(!descricao||descricao.length>500||!Number.isFinite(valor)||valor<=0||!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)||new Date(vencimento+'T12:00:00Z').toISOString().slice(0,10)!==vencimento)return NextResponse.json({error:'Descrição, valor e vencimento válidos são obrigatórios.'},{status:400})
  const {error}=await auth.supabase.from('contas_receber').insert({tenant_id:auth.tenantId,descricao,valor,vencimento})
  if(error)throw error
  return NextResponse.json({success:true},{status:201})
 }catch{return NextResponse.json({error:'Não foi possível cadastrar a conta.'},{status:400})}
}
export async function PATCH(request: Request) {
 try {
  const auth=await authenticatedTenant(['owner','manager']),status=tenantAuthStatus(auth)
  if(status)return NextResponse.json({error:'Sem permissão'},{status})
  const {id}=await request.json()
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Conta inválida'},{status:400})
  const {data,error}=await auth.supabase.from('contas_receber').update({recebido:true}).eq('tenant_id',auth.tenantId!).eq('id',id).eq('recebido',false).select('id')
  if(error)throw error
  if(!data?.length)return NextResponse.json({error:'Conta já recebida ou indisponível.'},{status:409})
  return NextResponse.json({success:true})
 }catch{return NextResponse.json({error:'Não foi possível confirmar o recebimento.'},{status:400})}
}
