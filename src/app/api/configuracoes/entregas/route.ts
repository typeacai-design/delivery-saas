import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const finite = (value: unknown) => Number.isFinite(Number(value))

export async function GET() {
  const { supabase, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!tenantId) return response({ error: forbidden ? 'Sem permissão' : 'Não autenticado' }, forbidden ? 403 : 401)
  const [{ data: bairros, error }, { data: tenant }] = await Promise.all([
    supabase.from('enderecos_entrega').select('id,bairro,taxa,prazo_min,ativo').eq('tenant_id', tenantId).order('bairro'),
    supabase.from('tenants').select('config,endereco,latitude,longitude').eq('id', tenantId).single(),
  ])
  if (error) return response({ error: error.message }, 400)
  const tenantConfig=(tenant?.config||{}) as any
  return response({ bairros: bairros || [], config: { ...(tenantConfig.entrega_km || {}), metodo: tenantConfig.entrega_metodo || 'bairro' }, origem: { endereco: tenant?.endereco || '', latitude: tenant?.latitude, longitude: tenant?.longitude } })
}

export async function POST(request: Request) {
  const { supabase, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!tenantId) return response({ error: forbidden ? 'Sem permissão' : 'Não autenticado' }, forbidden ? 403 : 401)
  const body = await request.json()
  if (body.kind === 'km') {
    const { data: tenant } = await supabase.from('tenants').select('config').eq('id', tenantId).single()
    const km = body.config || {}; const lat=Number(body.origem?.latitude), lng=Number(body.origem?.longitude)
    if (!['ceil','round','none'].includes(km.arredondamento) || !finite(km.valor_km) || Number(km.valor_km)<0 || !finite(km.minimo) || Number(km.minimo)<0 || !finite(km.max_km) || Number(km.max_km)<=0 || Number(km.max_km)>1000 || !Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lng)||lng < -180||lng > 180) return response({ error: 'Configuração por km inválida' }, 400)
    const entrega_km={valor_km:Number(km.valor_km),minimo:Number(km.minimo),max_km:Number(km.max_km),arredondamento:km.arredondamento,vender_sem_estoque:km.vender_sem_estoque===true}
    const config = { ...((tenant?.config || {}) as any), entrega_metodo: body.metodo === 'km' ? 'km' : 'bairro', entrega_km }
    const { error } = await supabase.from('tenants').update({ config, endereco: String(body.origem?.endereco||'').trim().slice(0,300)||null, latitude: lat, longitude: lng }).eq('id', tenantId)
    return error ? response({ error: error.message }, 400) : response({ ok: true })
  }
  // Salvar só a configuração (ex: vender_sem_estoque)
  if (body.kind === 'config') {
    console.log('Salvando config:', JSON.stringify(body.config))
    const { data: tenant } = await supabase.from('tenants').select('config').eq('id', tenantId).single()
    console.log('Tenant config atual:', JSON.stringify(tenant?.config))
    const currentConfig = (tenant?.config || {}) as any
    const newConfig = { ...currentConfig, entrega_km: { ...(currentConfig.entrega_km || {}), vender_sem_estoque: body.config?.vender_sem_estoque } }
    console.log('Nova config:', JSON.stringify(newConfig))
    const { error } = await supabase.from('tenants').update({ config: newConfig }).eq('id', tenantId)
    console.log('Erro:', error)
    return error ? response({ error: error.message }, 400) : response({ ok: true })
  }
  const bairro=String(body.bairro||'').trim().slice(0,100), taxa=Number(body.taxa), prazo=body.prazo_min==null||body.prazo_min===''?null:Number(body.prazo_min)
  if (!bairro || !Number.isFinite(taxa) || taxa<0 || taxa>100000 || (prazo!==null&&(!Number.isInteger(prazo)||prazo<1||prazo>10080))) return response({ error: 'Bairro, taxa ou prazo inválido' }, 400)
  const values={tenant_id:tenantId,bairro,taxa,prazo_min:prazo,ativo:body.ativo!==false}
  const query=body.id?supabase.from('enderecos_entrega').update(values).eq('id',body.id).eq('tenant_id',tenantId):supabase.from('enderecos_entrega').insert(values)
  const {error}=await query; return error?response({error:error.message},400):response({ok:true})
}

export async function DELETE(request: Request) {
  const { supabase, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!tenantId) return response({ error: forbidden ? 'Sem permissão' : 'Não autenticado' }, forbidden ? 403 : 401)
  const id=new URL(request.url).searchParams.get('id'); if(!id)return response({error:'ID obrigatório'},400)
  const {error}=await supabase.from('enderecos_entrega').delete().eq('id',id).eq('tenant_id',tenantId)
  return error?response({error:error.message},400):response({ok:true})
}
