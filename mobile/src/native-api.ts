/** Native operations use only the signed-in user's JWT and the database's existing RLS.
 * No service key, new HTTP service, website deployment, or permission bypass is used.
 */
import {supabase} from './supabase'
import {checkStore} from './catalog-api'
type Row=Record<string,any>
const DESIGN_KEYS=['cardapio_layout','cardapio_paleta','cardapio_cores','cardapio_tipografia','cardapio_whatsapp_ativo','cardapio_whatsapp_numero','cardapio_whatsapp_mensagem','cardapio_aviso_ativo','cardapio_aviso_mensagem','cardapio_aviso_textos','cardapio_aviso_animacao','cardapio_aviso_velocidade','cardapio_aviso_fundo','cardapio_aviso_texto','cardapio_aviso_link','cardapio_segunda_faixa_ativa','cardapio_segunda_faixa_mensagem','cardapio_segunda_faixa_link']
function unwrap(result:{data:any;error:any},message='Não foi possível concluir a operação.'){if(result.error)throw new Error(message);return result.data}
async function all(table:string,fields:string,storeId:string,order:string,signal?:AbortSignal,active=false){
 const rows:Row[]=[]
 for(let from=0;;from+=500){let q=supabase.from(table).select(fields).eq('tenant_id',storeId).order(order).order('id').range(from,from+499);if(active)q=q.eq('ativo',true);if(signal)q=q.abortSignal(signal);const data=unwrap(await q,'Não foi possível carregar os dados.')||[];rows.push(...data);if(data.length<500)return rows}
}
async function tenant(storeId:string,fields:string){return unwrap(await supabase.from('tenants').select(fields).eq('id',storeId).single(),'Não foi possível carregar a loja.')}
async function configPatch(storeId:string,patch:Row){const current=await tenant(storeId,'config');return unwrap(await supabase.from('tenants').update({config:{...(current.config||{}),...patch}}).eq('id',storeId).select('id,config').single(),'Não foi possível salvar a configuração.')}
function number(value:unknown,label:string){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error(`Confira ${label}.`);return n}
const reserved=new Set(['admin','api','login','dashboard','cardapio','configuracoes','suporte','registro','we-delivery','wedelivery'])
const slugify=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,60)
function cpfOk(v:string){if(!v)return true;if(v.length!==11||/^(\d)\1+$/.test(v))return false;const digit=(n:number)=>{let s=0;for(let i=0;i<n;i++)s+=Number(v[i])*(n+1-i);const x=s*10%11;return x===10?0:x};return digit(9)===Number(v[9])&&digit(10)===Number(v[10])}
export async function nativeRequest(storeId:string,path:string,method:string,body:Row={},signal?:AbortSignal):Promise<any>{
 await checkStore(storeId)
 const url=new URL(path,'https://native.invalid'),p=url.pathname,id=url.searchParams.get('id')
 if(p==='/api/financeiro'){
  if(method==='GET'){
   const [orders,expenses,transactions,t]=await Promise.all([all('pedidos','id,codigo,created_at,valor_total,taxa_entrega,forma_pagamento,status,pago,pago_em',storeId,'created_at',signal),all('despesas','id,nome,valor,dia_vencimento,recorrencia,created_at',storeId,'created_at',signal),all('movimentacoes_financeiras','id,tipo,descricao,valor,data,categoria,forma_pagamento,referencia_id',storeId,'data',signal),tenant(storeId,'id,config')]);return {orders,expenses,transactions,tenant:t}
  }
  if(method==='POST'){
   if(!['entrada','saida'].includes(body.tipo)||!['pedido','despesa','manual','recebimento','fornecedor'].includes(body.categoria)||!String(body.descricao||'').trim()||number(body.valor,'o valor')<=0)throw new Error('Confira o tipo, descrição e valor da movimentação.')
   return {success:true,movimentacao:unwrap(await supabase.from('movimentacoes_financeiras').insert({tenant_id:storeId,tipo:body.tipo,categoria:body.categoria,descricao:String(body.descricao).trim().slice(0,500),valor:Number(body.valor),data:body.data||new Date().toISOString().slice(0,10)}).select('id').single())}
  }
  if(method==='PUT'){return {success:true,tenant:await configPatch(storeId,{formas_pagamento_aceitas:Object.fromEntries(['dinheiro','pix','cartao_credito','cartao_debito'].map(k=>[k,body.formas?.[k]===true]))})}}
 }
 if(p==='/api/cardapio/design'){
  if(method==='GET')return {tenant:await tenant(storeId,'config,slug,logo_url,banner_url')}
  if(method==='POST'){if(!body.config||typeof body.config!=='object'||Array.isArray(body.config))throw new Error('Configuração inválida.');await configPatch(storeId,Object.fromEntries(DESIGN_KEYS.filter(k=>k in body.config).map(k=>[k,body.config[k]])));return {ok:true}}
 }
 if(p==='/api/perfil-loja'){
  if(method==='GET')return tenant(storeId,'nome,cpf,cnpj,categoria,tipo_estabelecimento,logo_url,telefone,endereco,numero,cidade,estado,bairro,complemento,cep,slug,email,nome_responsavel,created_at,updated_at')
  if(method==='PUT'){
   const slug=slugify(body.slug),cpf=String(body.cpf||'').replace(/\D/g,'').slice(0,11),cnpj=String(body.cnpj||'').replace(/\D/g,'').slice(0,14)
   if(slug.length<3||reserved.has(slug)||!String(body.nome||'').trim())throw new Error('Confira o nome e o link da loja.')
   if(!cpfOk(cpf)||cnpj&&cnpj.length!==14)throw new Error('Confira o CPF/CNPJ.')
   const existing=await supabase.from('tenants').select('id',{head:true,count:'exact'}).ilike('slug',slug).neq('id',storeId);if(existing.error)throw new Error('Não foi possível conferir o link.');if(existing.count)throw new Error('Esse link já está em uso.')
   const values={nome:String(body.nome).trim().slice(0,160),cpf:cpf||null,cnpj:cnpj||null,categoria:body.categoria||null,tipo_estabelecimento:body.categoria||null,telefone:String(body.telefone||'').replace(/\D/g,'').slice(0,15)||null,endereco:String(body.endereco||'').trim().slice(0,300)||null,numero:String(body.numero||'').slice(0,30)||null,cidade:String(body.cidade||'').slice(0,100)||null,estado:String(body.estado||'').slice(0,2).toUpperCase()||null,slug}
   unwrap(await supabase.from('tenants').update(values).eq('id',storeId).select('id').single());return {ok:true,slug}
  }
 }
 if(p==='/api/tickets'){
  if(method==='GET')return {tickets:await all('tickets','id,assunto,descricao,categoria,prioridade,status,resposta_admin,created_at',storeId,'created_at',signal)}
  if(method==='POST'){if(!String(body.assunto||'').trim()||!String(body.descricao||'').trim())throw new Error('Preencha assunto e descrição.');const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Entre novamente.');return unwrap(await supabase.from('tickets').insert({tenant_id:storeId,user_id:user.id,assunto:String(body.assunto).trim(),descricao:String(body.descricao).trim(),categoria:body.categoria||'duvida',prioridade:body.prioridade||'normal'}).select('id').single())}
 }
 if(p==='/api/mesas'){
  if(method==='GET')return {mesas:await all('mesas','id,numero,nome,capacidade,ativa',storeId,'numero',signal)}
  if(method==='POST'||method==='PATCH'){
   if(method==='PATCH'&&!id)throw new Error('Escolha uma mesa.');const values:Row={}
   if(body.numero!==undefined){values.numero=number(body.numero,'o número da mesa');if(!Number.isInteger(values.numero)||values.numero<1)throw new Error('Número da mesa inválido.')}
   if(body.nome!==undefined)values.nome=body.nome||`Mesa ${values.numero||''}`
   if(body.capacidade!==undefined){values.capacidade=number(body.capacidade,'a capacidade');if(!Number.isInteger(values.capacidade)||values.capacidade<1)throw new Error('Capacidade inválida.')}
   if(body.ativo!==undefined)values.ativa=body.ativo===true
   const q=method==='POST'?supabase.from('mesas').insert({...values,tenant_id:storeId,ativa:values.ativa!==false}):supabase.from('mesas').update(values).eq('tenant_id',storeId).eq('id',id!)
   return unwrap(await q.select('id').single())
  }
  if(method==='DELETE'&&id){unwrap(await supabase.from('mesas').update({ativa:false}).eq('tenant_id',storeId).eq('id',id).select('id').single());return {success:true}}
 }
 if(p==='/api/despesas'){
  if(method==='GET')return {despesas:await all('despesas','id,nome,valor,categoria,recorrencia,dia_vencimento,ativo',storeId,'dia_vencimento',signal,true)}
  if(method==='POST'){if(!String(body.nome||'').trim())throw new Error('Preencha o nome da despesa.');return unwrap(await supabase.from('despesas').insert({tenant_id:storeId,nome:body.nome,valor:number(body.valor,'o valor'),categoria:body.categoria||'fixa',recorrencia:body.recorrencia||'mensal',dia_vencimento:body.dia_vencimento||1}).select('id').single())}
  if(method==='DELETE'&&id){unwrap(await supabase.from('despesas').update({ativo:false}).eq('tenant_id',storeId).eq('id',id).select('id').single());return {success:true}}
 }
 if(p==='/api/membros-equipe'){
  if(method==='GET')return {membros:await all('membros_equipe','id,nome,username,perfil,ativo,created_at',storeId,'nome',signal)}
  // Password creation/reset remains with the existing server; this preview never stores legacy plaintext passwords.
  if(method==='POST'||body.senha)throw new Error('Cadastro e redefinição de senha da equipe ainda não estão disponíveis nesta versão de testes.')
  if(method==='PATCH'&&id){const values:Row={};if(body.nome!==undefined)values.nome=String(body.nome).trim().slice(0,80);if(body.ativo!==undefined)values.ativo=body.ativo===true;return {membro:unwrap(await supabase.from('membros_equipe').update(values).eq('tenant_id',storeId).eq('id',id).select('id,nome,username,perfil,ativo').single())}}
  if(method==='DELETE'&&id){unwrap(await supabase.from('membros_equipe').delete().eq('tenant_id',storeId).eq('id',id).select('id').single());return {ok:true}}
 }
 const orderMatch=p.match(/^\/api\/pedidos\/([a-f\d-]{36})(\/status)?$/i)
 if(orderMatch&&method==='PATCH'){
  const orderId=orderMatch[1]
  if(orderMatch[2]){
   if(body.pedido_id!==orderId||!['novo','preparando','pronto','saiu','entregue','cancelado'].includes(body.status))throw new Error('Etapa inválida.')
   const updates:Row={status:body.status,data_atualizacao:new Date().toISOString()}
   if(body.status==='cancelado')Object.assign(updates,{motivo_cancelamento:body.motivo_cancelamento||null,motivo_cancelamento_detalhe:body.motivo_cancelamento_detalhe||null,cancelado_por:'lojista',cancelado_em:new Date().toISOString()})
   if(body.status==='entregue')updates.entregue_em=new Date().toISOString()
   unwrap(await supabase.from('pedidos').update(updates).eq('tenant_id',storeId).eq('id',orderId).is('deleted_at',null).select('id').single());return {success:true,status:body.status}
  }
  const updates=Object.fromEntries(['cliente_nome','cliente_whatsapp','endereco_entrega','numero_entrega','complemento_entrega','bairro_entrega','observacoes'].filter(k=>body[k]!==undefined).map(k=>[k,body[k]]))
  if(Object.keys(body).some(k=>!(k in updates)))throw new Error('Edição da composição e valores ainda não está disponível nesta versão.')
  if(!Object.keys(updates).length)throw new Error('Nenhuma alteração para salvar.')
  unwrap(await supabase.from('pedidos').update(updates).eq('tenant_id',storeId).eq('id',orderId).is('deleted_at',null).select('id').single());return {ok:true}
 }
 if(p==='/api/upload-cardapio-asset'&&method==='DELETE'){
  const type=url.searchParams.get('tipo'),slot=Number(url.searchParams.get('slot')||0);if(!['logo','banner'].includes(type||'')||!Number.isInteger(slot)||slot<0||slot>2)throw new Error('Imagem inválida.')
  const t=await tenant(storeId,'logo_path,banner_path,config'),config={...(t.config||{})},banners=Array.isArray(config.cardapio_banners)?[...config.cardapio_banners]:[],path=type==='logo'?t.logo_path:banners[slot]?.path||(slot===0?t.banner_path:null)
  if(path?.startsWith(storeId+'/'))unwrap(await supabase.storage.from('cardapio-assets').remove([path]))
  let fields:Row={logo_url:null,logo_path:null};if(type==='banner'){banners[slot]=null;fields={config:{...config,cardapio_banners:banners},...(slot===0?{banner_url:null,banner_path:null}:{})}}
  unwrap(await supabase.from('tenants').update(fields).eq('id',storeId).select('id').single());return {ok:true}
 }
 throw new Error('Esta função ainda não está disponível nesta versão de testes.')
}
