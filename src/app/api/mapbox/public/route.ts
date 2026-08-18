import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimited } from '@/lib/customer-identity'

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}})
const out=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})
type MapboxFeature = { id?: unknown; place_name?: unknown; center?: unknown[] }
type DeliveryKmConfig = { max_km?: unknown; valor_km?: unknown; minimo?: unknown; arredondamento?: unknown }
const coord=(n:unknown,min:number,max:number)=>{const v=Number(n);return Number.isFinite(v)&&v>=min&&v<=max?v:null}
async function geocode(token:string,q:string){
  const r=await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=br&language=pt&limit=5&access_token=${encodeURIComponent(token)}`,{cache:'no-store'})
  if(!r.ok)return null
  return r.json()
}

export async function POST(request:Request){
  const admin=db(); const body=await request.json().catch(()=>null); if(!body||!['status','search','route'].includes(body.action))return out({error:'Operação inválida'},400)
  const slug=String(body.tenant_slug||'').trim().toLowerCase()
  const scope=['map-public',String(body.action),slug||'status'].join('-')
  if(await rateLimited(admin,request,scope,body.action==='search'?30:20))return out({error:'Limite excedido'},429)
  const token=process.env.MAPBOX_ACCESS_TOKEN; if(body.action==='status')return out({configured:Boolean(token)});if(!token)return out({configured:false,error:'Entrega por quilômetro indisponível. Escolha entrega por bairro ou retirada.'},503)
  const {data:t}=await admin.from('tenants').select('id,latitude,longitude,config').eq('slug',slug).eq('status','active').maybeSingle()
  if(!t)return out({error:'Loja indisponível'},404)
  if(body.action==='search'){
    const q=String(body.query||'').trim().slice(0,240); if(q.length<3)return out({configured:true,suggestions:[]})
    const data=await geocode(token,q); if(!data)return out({error:'Busca de endereço indisponível'},502)
    return out({configured:true,suggestions:(Array.isArray(data.features) ? data.features as MapboxFeature[] : []).flatMap((f)=>{const longitude=coord(f.center?.[0],-180,180),latitude=coord(f.center?.[1],-90,90);return longitude===null||latitude===null?[]:[{id:String(f.id),label:String(f.place_name||'').slice(0,300),longitude,latitude}]})})
  }
  const address=String(body.address||'').trim().slice(0,300); if(address.length<5)return out({error:'Endereço inválido'},400)
  const originLng=coord(t.longitude,-180,180),originLat=coord(t.latitude,-90,90); if(originLng===null||originLat===null)return out({error:'Origem da loja não configurada'},409)
  const geo=await geocode(token,address); const feature=geo?.features?.[0]; const destinationLng=coord(feature?.center?.[0],-180,180),destinationLat=coord(feature?.center?.[1],-90,90)
  if(destinationLng===null||destinationLat===null)return out({error:'Endereço não localizado'},422)
  const sentLng=coord(body.longitude,-180,180),sentLat=coord(body.latitude,-90,90)
  if(sentLng!==null&&sentLat!==null&&Math.hypot(sentLng-destinationLng,sentLat-destinationLat)>.03)return out({error:'O endereço mudou. Selecione novamente a sugestão.'},409)
  const coords=`${originLng},${originLat};${destinationLng},${destinationLat}`
  const rr=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=full&geometries=geojson&access_token=${encodeURIComponent(token)}`,{cache:'no-store'}); if(!rr.ok)return out({error:'Rota indisponível'},502)
  const route=(await rr.json()).routes?.[0]; if(!route||!Number.isFinite(route.distance)||!Number.isFinite(route.duration))return out({error:'Rota não encontrada'},404)
  const km=route.distance/1000,cfg=((t.config as { entrega_km?: DeliveryKmConfig } | null)?.entrega_km)||{},max=Number(cfg.max_km)
  if(!Number.isFinite(max)||max<=0)return out({error:'Taxa por km não configurada'},409); if(km>max)return out({error:'Endereço fora da área de entrega'},422)
  const perKm=Number(cfg.valor_km),minimum=Number(cfg.minimo); if(!Number.isFinite(perKm)||perKm<0||!Number.isFinite(minimum)||minimum<0)return out({error:'Taxa por km inválida'},409)
  const raw=Math.max(minimum,km*perKm),taxa=cfg.arredondamento==='ceil'?Math.ceil(raw):cfg.arredondamento==='round'?Math.round(raw):Math.round(raw*100)/100
  return out({address:String(feature.place_name||address),latitude:destinationLat,longitude:destinationLng,km,minutos:Math.ceil(route.duration/60),taxa,geometry:route.geometry})
}
