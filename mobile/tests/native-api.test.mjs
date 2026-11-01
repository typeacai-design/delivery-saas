import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=ts.transpileModule(fs.readFileSync('src/native-api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
function api(){
 const calls=[],writes=[]
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},from(table){const c={table,filters:[],op:'select'};calls.push(c);const q={select(fields){c.fields=fields;return q},eq(k,v){c.filters.push([k,v]);return q},neq(){return q},ilike(){return q},is(k,v){c.filters.push([k,v]);return q},order(){return q},range(){return q},abortSignal(){return q},single(){return q},update(value){c.op='update';c.value=value;writes.push(c);return q},insert(value){c.op='insert';c.value=value;writes.push(c);return q},delete(){c.op='delete';writes.push(c);return q},then(resolve){return Promise.resolve({data:c.op==='select'?(table==='tenants'?{config:{preserve:true}}:[]):{id:'saved'},error:null,count:0}).then(resolve)}};return q}}
 const sandbox={exports:{},URL,Date,console,require:name=>name==='./supabase'?{supabase:client}:{checkStore:async store=>{if(store!=='own-store')throw new Error('Forbidden store')}}}
 vm.runInNewContext(source,sandbox);return {call:sandbox.exports.nativeRequest,calls,writes}
}
test('A different store is rejected before any table query or mutation',async()=>{const a=api();await assert.rejects(a.call('foreign','/api/financeiro','POST',{tipo:'entrada',categoria:'manual',descricao:'Test',valor:10}));assert.equal(a.calls.length,0)})
test('Manual cash entry uses the selected store and an explicit column allowlist',async()=>{const a=api();await a.call('own-store','/api/financeiro','POST',{tenant_id:'foreign',tipo:'entrada',categoria:'manual',descricao:'Test',valor:10,password:'secret'});assert.equal(a.writes[0].value.tenant_id,'own-store');assert.equal(a.writes[0].value.password,undefined)})
test('Invalid cash input cannot reach a write',async()=>{const a=api();await assert.rejects(a.call('own-store','/api/financeiro','POST',{tipo:'entrada',categoria:'manual',descricao:'Test',valor:-1}));assert.equal(a.writes.length,0)})
test('Order updates include explicit tenant and order filters and reject a mismatched body id',async()=>{const a=api(),id='30000000-0000-4000-8000-000000000001';await assert.rejects(a.call('own-store',`/api/pedidos/${id}/status`,'PATCH',{pedido_id:'other',status:'entregue'}));assert.equal(a.writes.length,0);await a.call('own-store',`/api/pedidos/${id}/status`,'PATCH',{pedido_id:id,status:'preparando'});assert.deepEqual(a.writes[0].filters,[['tenant_id','own-store'],['id',id],['deleted_at',null]])})
test('Metadata edits cannot accidentally change items or order prices',async()=>{const a=api(),id='30000000-0000-4000-8000-000000000001';await assert.rejects(a.call('own-store',`/api/pedidos/${id}`,'PATCH',{cliente_nome:'Test',valor_total:0,itens:[]}));assert.equal(a.writes.length,0)})
test('Design saves preserve unrelated tenant configuration',async()=>{const a=api();await a.call('own-store','/api/cardapio/design','POST',{config:{cardapio_layout:'moderno',admin:true}});assert.equal(a.writes[0].value.config.preserve,true);assert.equal(a.writes[0].value.config.cardapio_layout,'moderno');assert.equal(a.writes[0].value.config.admin,undefined)})
test('Team queries never select password hashes and legacy password writes stay unavailable',async()=>{const a=api();await a.call('own-store','/api/membros-equipe','GET');assert.ok(!a.calls[0].fields.includes('password'));await assert.rejects(a.call('own-store','/api/membros-equipe','POST',{senha:'secret'}));assert.equal(a.writes.length,0)})
