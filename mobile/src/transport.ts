import {supabase} from './supabase'
import {checkStore} from './catalog-api'
import {nativeRequest} from './native-api'
import {File} from 'expo-file-system'
import {randomUUID} from 'expo-crypto'
export async function request<T=any>(storeId:string,path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 if(!path.startsWith('/api/')||path.includes('://')||path.includes('..'))throw new Error('Endereço de serviço inválido.')
 if(signal?.aborted)throw new Error('Operação cancelada.')
 return await nativeRequest(storeId,path,method,(body||{}) as Record<string,any>,signal) as T
}
type Photo={uri:string;mimeType?:string;fileName?:string|null;fileSize?:number}
async function photoBytes(asset:Photo){
 const type=asset.mimeType||'image/jpeg';if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('Selecione uma foto JPG, PNG ou WebP.')
 const file=new File(asset.uri);if((asset.fileSize||file.size)>5*1024*1024)throw new Error('A foto deve ter até 5 MB.')
 const bytes=await file.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw new Error('A foto deve ter até 5 MB.');if(!bytes.byteLength)throw new Error('A foto está vazia.')
 return {type,bytes,extension:type==='image/png'?'png':type==='image/webp'?'webp':'jpg'}
}
export async function uploadPhoto(storeId:string,asset:Photo){
 await checkStore(storeId);const {type,bytes,extension}=await photoBytes(asset),path=`${storeId}/produtos/${randomUUID()}.${extension}`
 const result=await supabase.storage.from('produtos').upload(path,bytes,{contentType:type,upsert:false});if(result.error)throw new Error('Não foi possível enviar a foto.')
 return {url:supabase.storage.from('produtos').getPublicUrl(path).data.publicUrl,path}
}
export async function uploadAsset(storeId:string,asset:Photo,tipo:'logo'|'banner',slot:number){
 await checkStore(storeId);if(!['logo','banner'].includes(tipo)||!Number.isInteger(slot)||slot<0||slot>2)throw new Error('Posição da imagem inválida.')
 const {type,bytes,extension}=await photoBytes(asset),path=`${storeId}/${tipo==='banner'?`banner-${slot}`:'logo'}.${extension}`
 const uploaded=await supabase.storage.from('cardapio-assets').upload(path,bytes,{contentType:type,upsert:true});if(uploaded.error)throw new Error('Não foi possível enviar a imagem.')
 const url=supabase.storage.from('cardapio-assets').getPublicUrl(path).data.publicUrl+'?v='+Date.now()
 let fields:Record<string,any>={logo_url:url,logo_path:path}
 if(tipo==='banner'){
  const current=await supabase.from('tenants').select('config').eq('id',storeId).single();if(current.error)throw new Error('Foto enviada, mas não foi possível carregar as configurações. Tente novamente.')
  const config={...(current.data.config||{})},banners=Array.isArray(config.cardapio_banners)?[...config.cardapio_banners]:[];banners[slot]={url,path}
  fields={config:{...config,cardapio_banners:banners},...(slot===0?{banner_url:url,banner_path:path}:{})}
 }
 const saved=await supabase.from('tenants').update(fields).eq('id',storeId).select('id').single();if(saved.error)throw new Error('Foto enviada, mas não foi possível salvar a alteração. Tente novamente.')
 return {url,path}
}
