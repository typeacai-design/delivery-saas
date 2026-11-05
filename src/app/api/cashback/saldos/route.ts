import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const {tenantId}=await authenticatedTenant(['owner','manager','attendant'])
    if(!tenantId)return NextResponse.json({error:'Não autorizado'},{status:401})
    const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await admin.from('cashback_creditos').select('cliente_id,valor_restante,expira_em').eq('tenant_id',tenantId).gt('valor_restante',0).limit(10000)
    if(error)throw error
    const now=Date.now()
    const saldos:Record<string,number>={}
    for(const c of data||[]){if(c.expira_em&&new Date(c.expira_em).getTime()<=now)continue;saldos[c.cliente_id]=(saldos[c.cliente_id]||0)+Number(c.valor_restante||0)}
    return NextResponse.json({saldos},{headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({error:'Erro ao consultar cashback'},{status:500})}
}
