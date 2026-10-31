import {supabase} from './supabase'
const origin=process.env.EXPO_PUBLIC_API_URL||'https://wedelivery.site'
export async function request<T=any>(storeId:string,path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 if(!path.startsWith('/api/')||path.includes('://')||path.includes('..'))throw new Error('Endereço de serviço inválido.')
 const {data:{session},error}=await supabase.auth.getSession();if(error||!session)throw new Error('Sua sessão expirou. Entre novamente.')
 const response=await fetch(origin+path,{method,signal,headers:{Authorization:`Bearer ${session.access_token}`,'x-wd-tenant-id':storeId,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const result=await response.json().catch(()=>null)
 if(!response.ok)throw new Error(result?.error||(response.status===401?'Entre novamente.':'Não foi possível concluir a operação.'))
 if(!result)throw new Error('O servidor retornou uma resposta inesperada.')
 return result as T
}
export async function uploadPhoto(storeId:string,asset:{uri:string;mimeType?:string;fileName?:string;fileSize?:number}){
 if(asset.fileSize&&asset.fileSize>5*1024*1024)throw new Error('A foto deve ter até 5 MB.')
 const type=asset.mimeType||'image/jpeg';if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('Selecione uma foto JPG, PNG ou WebP.')
 const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Entre novamente.')
 const form=new FormData();form.append('file',{uri:asset.uri,type,name:asset.fileName||'produto.jpg'} as any)
 const response=await fetch(origin+'/api/upload-produto',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'x-wd-tenant-id':storeId},body:form})
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível enviar a foto.');return result as {url:string;path:string}
}
