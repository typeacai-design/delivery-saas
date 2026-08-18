/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const { supabase, user, tenantId, forbidden } = await authenticatedTenant(['owner','manager'])
    if (!user || !tenantId) return NextResponse.json({ error: forbidden ? 'Sem permissao' : 'Nao autenticado' }, { status: forbidden ? 403 : 401 })
    const { searchParams } = new URL(request.url);const tabela=searchParams.get('tabela');const limit=Math.min(200,Math.max(1,parseInt(searchParams.get('limit')||'100',10)||100))
    let requestQuery=supabase.from('auditoria').select('*').eq('tenant_id',tenantId).order('criado_em',{ascending:false}).limit(limit);if(tabela)requestQuery=requestQuery.eq('tabela',tabela)
    const {data,error}=await requestQuery;if(error)throw error;return NextResponse.json({logs:data})
  } catch(error:any){return NextResponse.json({error:error.message},{status:500})}
}

export async function POST(request: Request) {
  try {
    const { user, tenantId, forbidden } = await authenticatedTenant(['owner','manager'])
    if (!user || !tenantId) return NextResponse.json({ error: forbidden ? 'Sem permissao' : 'Nao autenticado' }, { status: forbidden ? 403 : 401 })
    const body=await request.json();const acao=String(body.acao||'').slice(0,80);const tabela=String(body.tabela||'').slice(0,80)
    if(!acao||!tabela)return NextResponse.json({error:'Dados invalidos'},{status:400})
    const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
    const {error}=await admin.rpc('registrar_auditoria',{p_tenant_id:tenantId,p_user_id:user.id,p_acao:acao,p_tabela:tabela,p_registro_id:body.registro_id||null,p_dados_anteriores:body.dados_anteriores||null,p_dados_novos:body.dados_novos||null});if(error)throw error
    return NextResponse.json({ok:true})
  } catch(error:any){return NextResponse.json({error:error.message},{status:500})}
}