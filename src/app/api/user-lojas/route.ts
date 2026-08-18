import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: lojas, error } = await supabase
      .from('user_lojas')
      .select(`
        *,
        tenant:tenants(id, nome, slug, logo_url, cor_principal, status)
      `)
      .eq('user_id', user.id)
      .eq('ativo', true)

    if (error) throw error
    return NextResponse.json({ lojas })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Não autenticado'},{status:401})
  const {tenant_id}=await request.json().catch(()=>({}));if(!tenant_id)return NextResponse.json({error:'Loja obrigatória'},{status:400})
  const {data:member}=await supabase.from('usuarios_loja').select('tenant_id').eq('user_id',user.id).eq('tenant_id',tenant_id).eq('ativo',true).maybeSingle()
  if(!member)return NextResponse.json({error:'Acesso à loja não permitido'},{status:403})
  const response=NextResponse.json({ok:true});response.cookies.set('wd_active_tenant',member.tenant_id,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*365});return response
}
