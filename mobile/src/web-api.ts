import {createChunks,stringToBase64URL} from '@supabase/ssr'
import {supabase} from './supabase'
const origin='https://wedelivery.site'
const allowed=/^\/api\/(?:pedidos(?:\/manual|\/[a-f\d-]{36}(?:\/(?:status|desconto|apagar|avaliacao-convite))?)?|sessoes-mesa(?:\/[a-f\d-]{36}\/fechar)?|analytics|configuracoes\/(?:entregas|sabores|tempo-pico)|turnos-capacidade|membros-equipe|mapbox|whatsapp-pedido)$/i
export class WebApiError extends Error{constructor(message:string,public uncertain=false){super(message)}}
export function webPath(path:string){let decoded:string;try{decoded=decodeURIComponent(path)}catch{throw new Error('Endereço inválido.')}if(decoded.includes('..')||/[\r\n#\\]/.test(decoded)||!path.startsWith('/api/'))throw new Error('Endereço inválido.');const url=new URL(path,origin);if(url.origin!==origin||!allowed.test(url.pathname))throw new Error('Operação não permitida.');return url.toString()}
export function sessionCookie(session:any,storeId:string,url:string){if(!/^[a-f\d-]{36}$/i.test(storeId)||!session?.access_token||!session.refresh_token)throw new Error('Sessão inválida.');const ref=new URL(url).hostname.split('.')[0];if(!/^[a-z0-9]+$/.test(ref))throw new Error('Conexão inválida.');return [...createChunks(`sb-${ref}-auth-token`,'base64-'+stringToBase64URL(JSON.stringify(session))),{name:'wd_active_tenant',value:storeId}].map(c=>`${c.name}=${encodeURIComponent(c.value)}`).join('; ')}
export async function webRequest<T=any>(storeId:string,path:string,method:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const url=webPath(path);if(!['GET','POST','PATCH','DELETE','PUT'].includes(method))throw new Error('Operação inválida.')
 const {data:{session},error}=await supabase.auth.getSession();if(error||!session)throw new Error('Sua sessão expirou. Entre novamente.')
 const cookie=sessionCookie(session,storeId,process.env.EXPO_PUBLIC_SUPABASE_URL!),controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,30000)
 try{let response:Response;try{response=await fetch(url,{method,signal:controller.signal,credentials:'omit',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json',Cookie:cookie},...(body!==undefined&&method!=='GET'?{body:JSON.stringify(body)}:{})})}catch{throw new WebApiError('Não foi possível receber a confirmação do servidor.',method!=='GET')}
 let data:any;try{data=await response.json()}catch{throw new WebApiError('Resposta inválida do servidor.',method!=='GET')}
 if(!response.ok)throw new WebApiError(response.status===401?'Entre novamente.':response.status===403?'Sua conta não tem permissão para essa operação.':data?.error||'Não foi possível concluir.',method!=='GET'&&response.status>=500);return data
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
