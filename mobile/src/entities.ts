import {request} from './transport'
import {supabase} from './supabase'
import {numeric,type DataRow} from './product-model'
export type Field={key:string;label:string;kind?:'number'|'integer'|'boolean'|'array'|'choice'|'date'|'password';createOnly?:boolean;readOnly?:boolean;required?:boolean;choices?:[string,string][];relation?:'categorias'|'categorias_complementos';initial?:any}
export type Entity={title:string;table:string;fields:Field[];softDelete?:string;order:string;endpoint?:string;dataKey?:string;createOnly?:boolean;titleKey?:string}
const field=(key:string,label:string,kind?:Field['kind'],required=false,initial?:any):Field=>({key,label,kind,required,initial})
export const entities:Record<string,Entity>={
 clients:{title:'Clientes',table:'clientes',order:'nome',fields:[field('nome','Nome',undefined,true),field('telefone','Telefone',undefined,true),field('email','E-mail'),field('cep','CEP'),field('endereco','Endereço'),field('bairro','Bairro'),field('referencia','Referência'),field('data_nascimento','Nascimento (AAAA-MM-DD)','date'),field('observacoes','Observações'),field('tags','Etiquetas separadas por vírgula','array'),field('ativo','Ativo','boolean',false,true),field('opt_in_whatsapp','Autorizou mensagens no WhatsApp','boolean',false,false)]},
 stock:{title:'Matéria-prima',table:'insumos',order:'nome',fields:[field('nome','Nome',undefined,true),{...field('unidade','Unidade','choice',true,'un'),choices:[['un','Unidade'],['g','Grama'],['kg','Quilograma'],['ml','Mililitro'],['l','Litro']]},field('quantidade_atual','Quantidade atual','number',false,0),field('estoque_minimo','Estoque mínimo','number',false,0),field('custo_unitario','Custo unitário','number',false,0)]},
 coupons:{title:'Cupons',table:'cupons',order:'codigo',softDelete:'ativo',fields:[field('codigo','Código',undefined,true),{...field('tipo','Tipo de desconto','choice',true,'percentual'),choices:[['percentual','Percentual'],['valor_fixo','Valor fixo']]},field('valor','Valor do desconto','number',true),field('valor_minimo_pedido','Pedido mínimo','number',false,0),field('validade','Validade (AAAA-MM-DD)','date',true),field('max_usos','Limite de usos','integer'),field('ativo','Ativo','boolean',false,true)]},
 sections:{title:'Seções dos produtos',table:'categorias',order:'ordem',softDelete:'ativo',fields:[field('nome','Nome',undefined,true),field('ordem','Ordem','integer',false,0),field('ativo','Ativa','boolean',false,true)]},
 lists:{title:'Listas de complementos',table:'categorias_complementos',order:'ordem',softDelete:'ativo',fields:[field('nome','Nome',undefined,true),field('descricao','Descrição interna'),field('qtd_minima','Mínimo de opções','integer',false,0),field('qtd_maxima','Máximo de opções','integer',false,1),field('max_um_de_cada','No máximo um de cada','boolean',false,false),field('ordem','Ordem','integer',false,0),field('ativo','Ativa','boolean',false,true)]},
 addons:{title:'Complementos',table:'complementos',order:'ordem',softDelete:'ativo',fields:[field('nome','Nome',undefined,true),{...field('categoria_id','Lista','choice',true),relation:'categorias_complementos'},field('preco','Preço','number',false,0),field('custo','Custo','number',false,0),field('ordem','Ordem','integer',false,0),field('qtd_max','Quantidade máxima','integer',false,99),field('descricao','Descrição'),field('etiqueta1','Etiqueta 1'),field('etiqueta2','Etiqueta 2'),field('etiqueta3','Etiqueta 3'),field('controlar_estoque','Controlar estoque','boolean',false,false),field('quantidade_estoque','Quantidade em estoque','integer',false,0),field('ativo','Ativo','boolean',false,true),field('imagem_url','URL da foto')]},
}
Object.assign(entities,{
 team:{title:'Equipe',table:'membros_equipe',endpoint:'/api/membros-equipe',dataKey:'membros',order:'nome',fields:[field('nome','Nome',undefined,true),{...field('username','Nome de acesso',undefined,true),createOnly:true},{...field('senha','Senha','password'),initial:''},{...field('perfil','Função','choice',true,'attendant'),createOnly:true,choices:[['attendant','Atendimento'],['cozinha','Cozinha'],['motoboy','Motoboy']]},field('ativo','Ativo','boolean',false,true)]},
 support:{title:'Suporte',table:'tickets',endpoint:'/api/tickets',dataKey:'tickets',order:'created_at',createOnly:true,titleKey:'assunto',fields:[field('assunto','Assunto',undefined,true),field('descricao','Descrição',undefined,true),{...field('categoria','Categoria','choice',true,'duvida'),choices:[['duvida','Dúvida'],['bug','Problema no sistema'],['billing','Cobrança'],['sugestao','Sugestão']]},{...field('prioridade','Prioridade','choice',true,'normal'),choices:[['baixa','Baixa'],['normal','Normal'],['alta','Alta'],['urgente','Urgente']]},{...field('resposta_admin','Resposta do suporte'),readOnly:true},{...field('status','Situação'),readOnly:true}]},
 tables:{title:'Mesas',table:'mesas',endpoint:'/api/mesas',dataKey:'mesas',order:'numero',fields:[field('numero','Número','integer',true),field('nome','Nome'),field('capacidade','Pessoas','integer',false,4),field('ativo','Ativa','boolean',false,true)]},
 expenses:{title:'Despesas',table:'despesas',endpoint:'/api/despesas',dataKey:'despesas',order:'dia_vencimento',createOnly:true,fields:[field('nome','Nome',undefined,true),field('valor','Valor','number',true),{...field('categoria','Categoria','choice',true,'fixa'),choices:[['fixa','Fixa'],['variavel','Variável']]},{...field('recorrencia','Recorrência','choice',true,'mensal'),choices:[['mensal','Mensal'],['semanal','Semanal'],['unica','Única']]},field('dia_vencimento','Dia de vencimento','integer',false,1)]}
} satisfies Record<string,Entity>)
export async function rows(storeId:string,entity:Entity,signal?:AbortSignal){
 if(entity.endpoint){const result=await request(storeId,entity.endpoint,'GET',undefined,signal);return (result[entity.dataKey!]||[]).map((r:DataRow)=>entity.table==='mesas'?{...r,ativo:r.ativa}:r) as DataRow[]}

 const records:DataRow[]=[];const select=['id',...entity.fields.map(f=>f.key)].join(',')
 for(let offset=0;;offset+=100){let query=supabase.from(entity.table).select(select).eq('tenant_id',storeId).order(entity.order).order('id').range(offset,offset+99);if(signal)query=query.abortSignal(signal);const result=await query;if(result.error)throw new Error('Não foi possível carregar '+entity.title.toLowerCase()+'.');records.push(...(result.data as unknown as DataRow[]||[]));if(!result.data||result.data.length<100)return records}
}
export function entityPayload(entity:Entity,form:DataRow){
 const payload:DataRow={}
 for(const f of entity.fields){if(f.readOnly||f.createOnly&&form.id)continue;const value=form[f.key]??f.initial??'';if(f.kind==='password'&&form.id&&!value)continue;if(f.required&&(value===null||String(value).trim()===''))throw new Error(`Preencha ${f.label.toLowerCase()}.`)
  if(f.kind==='boolean')payload[f.key]=value===true
  else if(f.kind==='array')payload[f.key]=Array.isArray(value)?value:String(value).split(',').map(x=>x.trim()).filter(Boolean)
  else if(f.kind==='number'||f.kind==='integer')payload[f.key]=value===''?null:numeric(value,f.label,f.kind==='integer')
  else if(f.kind==='choice'){if(f.choices&&!f.choices.some(([key])=>key===value))throw new Error(`Selecione ${f.label.toLowerCase()}.`);payload[f.key]=value||null}
  else {payload[f.key]=String(value).trim()||null;if(f.kind==='date'&&value){const v=String(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw new Error('Informe uma data válida no formato AAAA-MM-DD.')}}
 }
 if(entity.table==='membros_equipe'&&(!form.id&&!payload.senha||payload.senha&&payload.senha.length<6))throw new Error('A senha deve ter pelo menos seis caracteres.')
 if(entity.table==='despesas'&&(payload.dia_vencimento<1||payload.dia_vencimento>31))throw new Error('Informe um dia entre 1 e 31.')
 if(entity.table==='mesas'&&(payload.numero<1||payload.capacidade<1))throw new Error('Número e capacidade devem ser maiores que zero.')
 if(entity.table==='cupons'){payload.codigo=payload.codigo.toUpperCase();if(payload.tipo==='percentual'&&payload.valor>100)throw new Error('O desconto percentual não pode passar de 100%.')}
 if(entity.table==='clientes'){payload.telefone=String(payload.telefone).replace(/\D/g,'');if(payload.telefone.length<10||payload.telefone.length>13)throw new Error('Confira o telefone do cliente.')}
 if(entity.table==='categorias_complementos'&&payload.qtd_minima>payload.qtd_maxima)throw new Error('O mínimo não pode ser maior que o máximo.')
 return payload
}
export async function saveEntity(storeId:string,entity:Entity,form:DataRow,id?:string){
 const {checkStore}=await import('./catalog-api');await checkStore(storeId);const payload=entityPayload(entity,form)
 if(entity.endpoint){await request(storeId,entity.endpoint+(id?'?id='+encodeURIComponent(id):''),id?'PATCH':'POST',payload);return}
 if(entity.table==='clientes'&&!id){const existing=await supabase.from('clientes').select('id').eq('tenant_id',storeId).eq('telefone',payload.telefone).maybeSingle();if(existing.error)throw new Error('Não foi possível conferir o telefone.');if(existing.data)throw new Error('Já existe um cliente com esse telefone. Edite o cadastro existente.')}
 const query=id?supabase.from(entity.table).update(payload).eq('tenant_id',storeId).eq('id',id):supabase.from(entity.table).insert({...payload,tenant_id:storeId})
 const result=await query.select('id').single();if(result.error)throw new Error('Não foi possível salvar: '+result.error.message)
}
export async function removeEntity(storeId:string,entity:Entity,id:string){
 const {checkStore}=await import('./catalog-api');await checkStore(storeId)
 if(entity.endpoint){await request(storeId,entity.endpoint+'?id='+encodeURIComponent(id),'DELETE');return}
 const query=entity.softDelete?supabase.from(entity.table).update({[entity.softDelete]:false}):supabase.from(entity.table).delete()
 const result=await query.eq('tenant_id',storeId).eq('id',id).select('id').single();if(result.error)throw new Error('Não foi possível excluir: '+result.error.message)
}
