export type DataRow = Record<string, any>
export const productGroups = [
 {title:'Dados básicos', fields:[['nome','Nome'],['descricao','Descrição'],['codigo_externo','Código externo'],['preco','Preço','money'],['preco_riscado','Preço anterior','money'],['ordem','Ordem','integer'],['tempo_preparo_min','Preparo em minutos','integer'],['exibir_preco_a_partir_de','Mostrar “a partir de”','boolean']]},
 {title:'Pontos de fidelidade e limites', fields:[['pontos','Pontos','integer'],['limite_vendas_dia','Limite por dia','integer'],['limite_vendas_turno','Limite por turno','integer']]},
 {title:'Visibilidade e etiquetas', fields:[['disponivel_mesa','Mesa','boolean'],['disponivel_delivery','Delivery','boolean'],['disponivel_retirada','Retirada','boolean'],['eh_adicional','Produto adicional','boolean']]},
 {title:'Disponibilidade', fields:[['horario_inicio','Disponível a partir de'],['horario_fim','Disponível até']]},
 {title:'Estoque',fields:[['controlar_estoque','Controlar estoque','boolean'],['quantidade_estoque','Quantidade','integer']]},
 {title:'Outras opções',fields:[['pode_ser_metade','Permitir metade','boolean'],['texto_metade','Texto da metade'],['fracionar_item','Fracionar item','boolean']]},
] as const
export const emptyProduct: DataRow = {nome:'',descricao:'',preco:'',preco_riscado:'',categoria_id:'',ordem:0,pontos:0,tempo_preparo_min:30,exibir_preco_a_partir_de:false,disponivel_mesa:true,disponivel_delivery:true,disponivel_retirada:true,eh_adicional:false,etiquetas:[],dias_disponiveis:[0,1,2,3,4,5,6],horario_inicio:'00:00',horario_fim:'23:59',controlar_estoque:false,quantidade_estoque:0,limite_vendas_dia:0,limite_vendas_turno:0,sabores_grupo_id:null,sabores_maximo:2,pode_ser_metade:false,fracionar_item:false,texto_metade:'',codigo_externo:'',imagem_url:null,imagem_path:null}
export function numeric(value: unknown, label: string, integer=false) {
 const n=Number(String(value??'').replace(',','.')); if(!Number.isFinite(n)||n<0||(integer&&!Number.isInteger(n))) throw new Error(`${label}: informe um número ${integer?'inteiro ':''}maior ou igual a zero.`);return n
}
export function productPayload(form: DataRow, products: DataRow[], complements: DataRow[], id?:string) {
 if(!String(form.nome||'').trim()||!form.categoria_id||String(form.preco)==='')throw new Error('Preencha nome, preço e seção.')
 const out:DataRow={categoria_id:form.categoria_id,nome:String(form.nome).trim(),etiquetas:form.etiquetas||[],dias_disponiveis:form.dias_disponiveis||[]}
 for(const group of productGroups)for(const [key,label,...kind] of group.fields){
  if(key==='nome')continue
  out[key]=kind[0]==='boolean'?form[key]===true:kind[0]==='money'||kind[0]==='integer'?((key==='preco_riscado'&&(form[key]===''||form[key]===null))?null:numeric(form[key],label,kind[0]==='integer')):String(form[key]??'')||null
 }
 if(out.ordem>0&&products.some(p=>p.id!==id&&p.categoria_id===form.categoria_id&&Number(p.ordem)===out.ordem))throw new Error('Essa ordem já está sendo usada nesta seção.')
 for(const key of ['horario_inicio','horario_fim'])if(!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(out[key])))throw new Error('Use horários no formato HH:MM.')
 if(!out.dias_disponiveis.every((d:unknown)=>Number.isInteger(d)&&Number(d)>=0&&Number(d)<=6))throw new Error('Dias de disponibilidade inválidos.')
 const flavor=form.sabores_grupo_id||null, max=form.sabores_maximo===3?3:2,items=complements.filter(c=>c.categoria_id===flavor&&c.ativo!==false)
 if(flavor&&(items.length<max||items.some(c=>c.controlar_estoque)))throw new Error('Escolha uma lista com sabores ativos suficientes e sem controle de estoque.')
 return {...out,secao_destaque:out.etiquetas.length>0,sabores_grupo_id:flavor,sabores_maximo:max,imagem_url:form.imagem_url||null,imagem_path:form.imagem_path||null}
}
export function toggleList(selected:string[],complements:DataRow[],listId:string){const ids=complements.filter(c=>c.categoria_id===listId).map(c=>c.id);const all=ids.length>0&&ids.every(id=>selected.includes(id));const next=new Set(selected);for(const id of ids)all?next.delete(id):next.add(id);return [...next]}
