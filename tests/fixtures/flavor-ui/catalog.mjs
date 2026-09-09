export const product = {id:'pizza',nome:'Pizza Grande',preco:100,sabores_grupo_id:'sabores',sabores_maximo:3,categoria_id:'pizzas',ativo:true}
export const complements = [
 {id:'calabresa',nome:'Calabresa',preco:30,categoria_id:'sabores',ativo:true},
 {id:'frango',nome:'Frango',preco:36,categoria_id:'sabores',ativo:true},
 {id:'portuguesa',nome:'Portuguesa',preco:39,categoria_id:'sabores',ativo:true},
 {id:'borda',nome:'Borda recheada',preco:8,categoria_id:'extras',ativo:true},
]
export function mockCatalog(table,query) {
 if(table==='tenants') return {id:'synthetic-tenant',nome:'Local Pizzaria',slug:query.get('slug')?.replace('eq.','')||'local-on',status:'active',sabores_ativo:query.get('slug')!=='eq.local-off',telefone:'00000000000',logo_url:null,banner_url:null,config:{loja_aberta:true,cardapio_layout:query.get('slug')==='eq.local-modern'?'moderno':query.get('slug')==='eq.local-minimal'?'minimalista':'classico'}}
 const rows = {
  categorias:[{id:'pizzas',nome:'Pizzas',ativo:true,ordem:1}],
  produtos:[product],variantes:[],complementos:complements,
  categorias_complementos:[{id:'sabores',nome:'Sabores',ativo:true,qtd_minima:0,qtd_maxima:99},{id:'extras',nome:'Adicionais',ativo:true,qtd_minima:0,qtd_maxima:1}],
  produto_complementos:complements.map(c=>({produto_id:'pizza',complemento_id:c.id})),
  avaliacoes:[],enderecos_entrega:[],
 }
 return rows[table]||[]
}
