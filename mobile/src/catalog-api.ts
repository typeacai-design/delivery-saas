import { supabase } from './supabase'
import { productPayload, numeric, type DataRow } from './product-model'
export async function checkStore(storeId:string){
 const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw new Error('Sua sessão expirou.')
 const membership=await supabase.from('usuarios_loja').select('role').eq('user_id',user.id).eq('tenant_id',storeId).eq('ativo',true).in('role',['owner','manager']).maybeSingle()
 const tenant=await supabase.from('tenants').select('status,bloqueado').eq('id',storeId).maybeSingle()
 if(membership.error||!membership.data||tenant.error||tenant.data?.status!=='active'||tenant.data?.bloqueado)throw new Error('Sua conta não pode editar esta loja.')
}
function check(result:{error:any},message:string){if(result.error)throw new Error(`${message}: ${result.error.message}`)}
export async function productOptions(storeId:string,productId?:string){
 const [lists,complements,ingredients,links,recipes]=await Promise.all([
  supabase.from('categorias_complementos').select('id,nome,descricao').eq('tenant_id',storeId).eq('ativo',true).order('ordem'),
  supabase.from('complementos').select('id,nome,categoria_id,preco,ativo,controlar_estoque').eq('tenant_id',storeId).eq('ativo',true).order('nome'),
  supabase.from('insumos').select('id,nome,unidade,custo_unitario').eq('tenant_id',storeId).order('nome'),
  productId?supabase.from('produto_complementos').select('complemento_id').eq('produto_id',productId):Promise.resolve({data:[],error:null}),
  productId?supabase.from('produto_ingredientes').select('insumo_id,quantidade').eq('tenant_id',storeId).eq('produto_id',productId):Promise.resolve({data:[],error:null}),
 ])
 for(const result of [lists,complements,ingredients,links,recipes])check(result,'Não foi possível carregar as opções')
 return {lists:lists.data||[],complements:complements.data||[],ingredients:ingredients.data||[],selected:(links.data||[]).map(x=>x.complemento_id as string),recipes:(recipes.data||[]) as DataRow[]}
}
export async function saveProduct(storeId:string,form:DataRow,products:DataRow[],options:Awaited<ReturnType<typeof productOptions>>,selected:string[],recipes:DataRow[],id?:string){
 await checkStore(storeId)
 const payload=productPayload(form,products,options.complements,id)
 if(!products.some(p=>p.categoria_id===form.categoria_id)&&!form.categoria_id)throw new Error('Selecione uma seção.')
 for(const r of recipes)if(r.quantidade!=='')numeric(r.quantidade,'Quantidade do ingrediente')
 const validRecipes=recipes.filter(x=>x.quantidade!==''&&Number(String(x.quantidade).replace(',','.'))>0)
 if(validRecipes.some(x=>!options.ingredients.some(i=>i.id===x.insumo_id)))throw new Error('Ingrediente indisponível nesta loja.')
 const result=id?await supabase.from('produtos').update(payload).eq('tenant_id',storeId).eq('id',id).select('id').single():await supabase.from('produtos').insert({...payload,tenant_id:storeId,ativo:true}).select('id').single()
 check(result,'Não foi possível salvar o produto');const productId=result.data!.id
 // Preserve a successful new ID on partial failures so retries never create a duplicate.
 try{
  const current=await supabase.from('produto_complementos').select('complemento_id').eq('produto_id',productId);check(current,'Não foi possível conferir os complementos')
  const old=new Set((current.data||[]).map(x=>x.complemento_id)),desired=new Set(selected)
  if(form.sabores_grupo_id)for(const c of options.complements.filter(c=>c.categoria_id===form.sabores_grupo_id))desired.add(c.id)
  const additions=[...desired].filter(x=>!old.has(x)),removals=[...old].filter(x=>!desired.has(x))
  if(additions.length)check(await supabase.from('produto_complementos').insert(additions.map(complemento_id=>({produto_id:productId,complemento_id}))),'Produto salvo, mas houve falha ao vincular listas')
  if(removals.length)check(await supabase.from('produto_complementos').delete().eq('produto_id',productId).in('complemento_id',removals),'Produto salvo, mas houve falha ao remover vínculos')
  // Upsert recipe additions before deleting removed rows.
  for(const r of validRecipes)check(await supabase.from('produto_ingredientes').upsert({tenant_id:storeId,produto_id:productId,insumo_id:r.insumo_id,quantidade:Number(String(r.quantidade).replace(',','.'))},{onConflict:'produto_id,insumo_id'}),'Produto salvo, mas houve falha ao salvar a receita')
  const wanted=new Set(validRecipes.map(r=>r.insumo_id)),removed=options.recipes.filter(r=>!wanted.has(r.insumo_id)).map(r=>r.insumo_id)
  if(removed.length)check(await supabase.from('produto_ingredientes').delete().eq('tenant_id',storeId).eq('produto_id',productId).in('insumo_id',removed),'Produto salvo, mas houve falha ao atualizar a receita')
 }catch(error){throw Object.assign(error instanceof Error?error:new Error('Falha ao salvar vínculos.'),{savedProductId:productId})}
 return productId
}
export async function productAction(storeId:string,id:string,updates:DataRow){await checkStore(storeId);check(await supabase.from('produtos').update(updates).eq('tenant_id',storeId).eq('id',id).select('id').single(),'Não foi possível alterar o produto')}
