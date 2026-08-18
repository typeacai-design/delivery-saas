import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { rateLimited } from '@/lib/customer-identity'

const out=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})
type MapboxFeature = { id?: unknown; place_name?: unknown; center?: unknown[] }
type MapboxSearchResponse = { features?: MapboxFeature[] }
const finiteCoord=(value:unknown,min:number,max:number)=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}

export async function GET(){
  const {tenantId,forbidden}=await authenticatedTenant(['owner','manager']);if(!tenantId)return out({error:forbidden?'Sem permissão':'Não autenticado'},forbidden?403:401)
  return out({configured:Boolean(process.env.MAPBOX_ACCESS_TOKEN)})
}

export async function POST(request: Request) {
  const { tenantId, forbidden } = await authenticatedTenant(['owner','manager'])
  if(!tenantId)return out({error:forbidden?'Sem permissão':'Não autenticado'},forbidden?403:401)
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}})
  if(await rateLimited(admin,request,`map-admin-${tenantId}`,40))return out({error:'Limite excedido'},429)
  const token=process.env.MAPBOX_ACCESS_TOKEN;if(!token)return out({configured:false,error:'MAPBOX_ACCESS_TOKEN não configurado'},503)
  const body=await request.json().catch(()=>null);if(!body||!['search','route'].includes(body.action))return out({error:'Operação inválida'},400)
  if(body.action==='search'){
    const q=String(body.query||'').trim().slice(0,240);if(q.length<3)return out({configured:true,suggestions:[]})
    const r=await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=br&language=pt&limit=6&access_token=${encodeURIComponent(token)}`,{cache:'no-store'});if(!r.ok)return out({error:'Busca indisponível'},502)
    const data=await r.json() as MapboxSearchResponse;return out({configured:true,suggestions:(Array.isArray(data.features)?data.features:[]).flatMap((f)=>{const longitude=finiteCoord(f.center?.[0],-180,180),latitude=finiteCoord(f.center?.[1],-90,90);return longitude===null||latitude===null?[]:[{id:String(f.id),label:String(f.place_name||'').slice(0,300),longitude,latitude}]})})
  }
  const aLng=finiteCoord(body.origem?.longitude,-180,180),aLat=finiteCoord(body.origem?.latitude,-90,90),bLng=finiteCoord(body.destino?.longitude,-180,180),bLat=finiteCoord(body.destino?.latitude,-90,90)
  if([aLng,aLat,bLng,bLat].some(v=>v===null))return out({error:'Coordenadas inválidas'},400)
  const r=await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${aLng},${aLat};${bLng},${bLat}?overview=full&geometries=geojson&access_token=${encodeURIComponent(token)}`,{cache:'no-store'});if(!r.ok)return out({error:'Rota indisponível'},502)
  const route=(await r.json()).routes?.[0];return route&&Number.isFinite(route.distance)&&Number.isFinite(route.duration)?out({km:route.distance/1000,minutos:Math.ceil(route.duration/60),geometry:route.geometry}):out({error:'Rota não encontrada'},404)
}
