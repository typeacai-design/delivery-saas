import test from 'node:test'
import assert from 'node:assert/strict'
import * as flavor from '../src/lib/flavor-pricing.ts'
import * as pricing from '../src/lib/product-pricing.ts'
import { compile, server, database, item } from './flavor-fixtures.mjs'
const options = [{ id:'a',nome:'Calabresa',preco:30 },{ id:'b',nome:'Frango',preco:36 },{ id:'c',nome:'Portuguesa',preco:39 }]
for (const [n,total] of [[1,30],[2,33],[3,35]]) test(`mean of ${n} full flavor prices`, () => {
  const snapshot = flavor.createFlavorSnapshot(options.slice(0,n),'flavors',n)
  assert.equal(pricing.savedItemTotal({valor_unitario:0,quantidade:1,complementos:snapshot}),total)
  assert.equal(flavor.flavorCount(JSON.stringify(snapshot)),n)
  assert.ok(snapshot.every(c => c.quantidade === 1 && c.preco_integral === options.find(o=>o.id===c.id).preco))
})
test('cent allocation sums rounded mean, deterministic regardless selection order', () => {
  const input = options.map((o,index)=>({...o,preco:[30.01,36.02,39.02][index]}))
  const forward = flavor.createFlavorSnapshot(input,'flavors',3)
  const reverse = flavor.createFlavorSnapshot([...input].reverse(),'flavors',3)
  assert.equal(pricing.savedItemTotal({valor_unitario:0,quantidade:2,complementos:forward}),70.04)
  for (const c of forward) assert.equal(c.valor,reverse.find(r=>r.id===c.id).valor)
  assert.equal(forward.reduce((s,c)=>s+Math.round(c.valor*100),0),3502)
})
test('invalid counts, duplicate IDs and invalid prices are rejected',()=>{
  assert.throws(()=>flavor.createFlavorSnapshot(options.slice(0,2),'flavors',3))
  assert.throws(()=>flavor.createFlavorSnapshot([options[0],options[0]],'flavors',2))
  assert.throws(()=>flavor.createFlavorSnapshot([{...options[0],preco:-1}],'flavors',1))
})
test('historical strings and ordinary complements remain compatible',()=>{
  assert.equal(flavor.flavorCount('[{"nome":"old","valor":5}]'),null)
  assert.equal(flavor.flavorLabel({nome:'old'}),'old')
  assert.deepEqual(flavor.parseComplements('broken'),[])
  assert.equal(pricing.savedItemTotal({valor_unitario:20,quantidade:2,complementos:'[{"preco":5}]'}),50)
})
test('authoritative flavor validator ignores browser prices and old generic group max of one',async()=>{
  const db=database();const result=await server.validateFlavorItem(db,'shop',true,db.rows.produtos[0],item(2,['a','b','edge']))
  assert.equal(result.valor_unitario,0)
  assert.equal(pricing.savedItemTotal(result),41)
  assert.equal(result.complementos.find(c=>c.id==='edge').valor,8)
})
for (const [name,change] of [
 ['master disabled', (db,i)=>[false,i]],
 ['missing count',(db,i)=>[true,{...i,sabores_quantidade:undefined}]],
 ['too many flavors',(db,i)=>[true,{...i,sabores_quantidade:4}]],
 ['duplicate flavors',(db,i)=>[true,item(2,['a','a'])]],
 ['fraction quantity',(db,i)=>[true,{...i,quantidade:0.5}]],
 ['unlinked flavor',(db,i)=>{db.rows.produto_complementos=db.rows.produto_complementos.filter(v=>v.complemento_id!=='b');return[true,i]}],
 ['other tenant flavor',(db,i)=>{db.rows.complementos[1].tenant_id='other';return[true,i]}],
 ['inactive flavor',(db,i)=>{db.rows.complementos[1].ativo=false;return[true,i]}],
 ['controlled flavor',(db,i)=>{db.rows.complementos[1].controlar_estoque=true;return[true,i]}],
 ['product variant',(db,i)=>{db.rows.variantes=[{id:'v',produto_id:'pizza'}];return[true,i]}],
]) test(`reject ${name} before any write`,async()=>{
 const db=database();const [active,request]=change(db,item());await assert.rejects(server.validateFlavorItem(db,'shop',active,db.rows.produtos[0],request));assert.equal(db.writes.length,0)
})
test('manual canonical totals ignore tampered aggregate and preserve explicit fee/discount/surcharge',async()=>{
 const db=database();const result=await server.normalizeManualFlavorItems(db,'shop',[item(2,['a','b','edge'])]);
 assert.equal(result.hasFlavors,true)
 const totals=server.manualFlavorTotals(result.items,{valor_total:0,valor_subtotal:0,taxa_entrega:5,valor_desconto:2,valor_acrescimo:3})
 assert.equal(totals.subtotal,41);assert.equal(totals.total,47)
})
test('unchanged edit trusts saved snapshots, accepts quantity-only changes and detects composition changes',()=>{
 const saved={...item(),complementos:flavor.createFlavorSnapshot(options.slice(0,2),'flavors',2)}
 assert.equal(server.unchangedSavedComposition(saved,{...saved,quantidade:3,complementos:saved.complementos.map(c=>({...c,valor:0}))}),true)
 assert.equal(server.unchangedSavedComposition(saved,item(2,['a','c'])),false)
})
function publicApi(db) {
 return compile('src/app/api/pedidos/public/route.ts', {
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@supabase/supabase-js':{createClient:()=>db}, '@/lib/product-pricing':pricing,'@/lib/flavor-order-server':server,
  '@/lib/customer-identity':{rateLimited:async()=>false,isValidCpf:()=>true,hashAccessToken:v=>v,normalizeCpf:v=>v,tokenMatches:()=>true},
 })
}
for (const [n,ids,total] of [[1,['a'],30],[2,['a','b','edge'],41],[3,['a','b','c'],35]]) test(`public API persists authoritative ${n}-flavor snapshot through existing RPC`,async()=>{
 const db=database(); db.rows.tenants[0].slug='shop'
 const response=await publicApi(db).POST(new Request('https://test.invalid/api/pedidos/public',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'k'.repeat(32)},body:JSON.stringify({tenant_slug:'shop',cliente_nome:'Test',cliente_whatsapp:'85999999999',cliente_access_token:'t'.repeat(32),tipo_entrega:'retirada',itens:[item(n,ids)],valor_total:0,formas_pagamento:[{forma:'dinheiro',valor:total}]})}))
 const body=await response.json(); assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.valor_total,total)
 assert.equal(db.writes[0].name,'criar_pedido_atomico');assert.equal(db.writes[0].args.p_itens[0].valor_unitario,0)
 assert.equal(flavor.flavorCount(db.writes[0].args.p_itens[0].complementos),n)
})

function staffApi(db, path, tenantId='shop') {
 return compile(path, {
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@supabase/supabase-js':{createClient:()=>db}, '@/lib/product-pricing':pricing,'@/lib/flavor-order-server':server,'@/lib/flavor-pricing':flavor,
  '@/lib/tenant-auth':{authenticatedTenant:async()=>({tenantId,supabase:db,user:{id:'owner'}}),tenantAuthStatus:auth=>auth.tenantId?null:403,SALES_ROLES:['owner','manager','attendant'],MANAGEMENT_ROLES:['owner','manager']},
 })
}
test('manual API reconstructs flavor totals and invokes one atomic write',async()=>{
 const db=database(); const response=await staffApi(db,'src/app/api/pedidos/manual/route.ts').POST(new Request('https://test.invalid/api/pedidos/manual',{method:'POST',body:JSON.stringify({itens:[item(2,['a','b','edge'])],valor_subtotal:0,valor_total:0,taxa_entrega:5,valor_desconto:2,valor_acrescimo:3,forma_pagamento:'dinheiro'})}))
 const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.valor_total,47);assert.equal(body.valor_subtotal,41)
 assert.equal(db.writes.length,1);assert.equal(db.writes[0].name,'criar_pedido_manual_atomico')
})
test('manual invalid flavor selection writes no order or items',async()=>{
 const db=database(); const response=await staffApi(db,'src/app/api/pedidos/manual/route.ts').POST(new Request('https://test.invalid/api/pedidos/manual',{method:'POST',body:JSON.stringify({itens:[item(3,['a','b'])],valor_total:1})}))
 assert.equal(response.status,400);assert.equal(db.writes.length,0)
})
test('edit retains historical flavor prices after catalogue changes on quantity increase when enabled',async()=>{
 const db=database();db.rows.complementos[0].preco=90
 const snapshot=flavor.createFlavorSnapshot(options.slice(0,2),'flavors',2)
 db.rows.pedidos=[{id:'order',tenant_id:'shop',valor_subtotal:33,taxa_entrega:5,valor_desconto:2,valor_total:39,data_atualizacao:'2026-09-01T00:00:00Z'}]
 db.rows.pedido_itens=[{id:'line',pedido_id:'order',produto_id:'pizza',nome:'Pizza',quantidade:1,valor_unitario:0,complementos:snapshot}]
 const response=await staffApi(db,'src/app/api/pedidos/[id]/route.ts').PATCH(new Request('https://test.invalid/api/pedidos/order',{method:'PATCH',body:JSON.stringify({itens:[{...db.rows.pedido_itens[0],quantidade:2,complementos:snapshot.map(c=>({...c,valor:0}))}]})}),{params:Promise.resolve({id:'order'})})
 assert.equal(response.status,200);assert.equal(db.writes.length,1)
 assert.equal(db.writes[0].args.p_updates.valor_subtotal,66);assert.equal(db.writes[0].args.p_updates.valor_total,72)
 assert.equal(db.writes[0].args.p_itens[0].complementos[0].valor,15)
 assert.equal(db.writes[0].args.p_versao,'2026-09-01T00:00:00Z')
})
test('editing flavor composition when feature disabled rejects before transactional mutation',async()=>{
 const db=database();db.rows.tenants[0].sabores_ativo=false
 db.rows.pedidos=[{id:'order',tenant_id:'shop',valor_subtotal:33,taxa_entrega:0,valor_desconto:0,valor_total:33,data_atualizacao:null}]
 db.rows.pedido_itens=[{id:'line',pedido_id:'order',produto_id:'pizza',quantidade:1,valor_unitario:0,complementos:flavor.createFlavorSnapshot(options.slice(0,2),'flavors',2)}]
 const response=await staffApi(db,'src/app/api/pedidos/[id]/route.ts').PATCH(new Request('https://test.invalid/api/pedidos/order',{method:'PATCH',body:JSON.stringify({itens:[item(2,['a','c'])]})}),{params:Promise.resolve({id:'order'})})
 assert.equal(response.status,400);assert.equal(db.writes.length,0)
})

test('mixed manual orders cannot offset pizza with negative or invalid ordinary lines',()=>{
 const pizza={produto_id:'pizza',valor_unitario:0,quantidade:1,complementos:flavor.createFlavorSnapshot(options.slice(0,2),'flavors',2)}
 assert.throws(()=>server.manualFlavorTotals([pizza,{valor_unitario:-33,quantidade:1}],{}))
 assert.throws(()=>server.manualFlavorTotals([pizza,{valor_unitario:10,quantidade:0.5}],{}))
 assert.throws(()=>server.manualFlavorTotals([pizza,{valor_unitario:10,quantidade:1,complementos:[{valor:-10}]}],{}))
 const result=server.manualFlavorTotals([pizza,{valor_unitario:10,quantidade:2,complementos:[{valor:2,quantidade:1}]}],{valor_total:0})
 assert.equal(result.subtotal,57);assert.equal(result.total,57)
})

test('increasing historical pizza quantity after master deactivation rejects before mutation',async()=>{
 const db=database();db.rows.tenants[0].sabores_ativo=false
 const snapshot=flavor.createFlavorSnapshot(options.slice(0,2),'flavors',2)
 db.rows.pedidos=[{id:'order',tenant_id:'shop',valor_subtotal:33,taxa_entrega:0,valor_desconto:0,valor_total:33,data_atualizacao:null}]
 db.rows.pedido_itens=[{id:'line',pedido_id:'order',produto_id:'pizza',quantidade:1,valor_unitario:0,complementos:snapshot}]
 const route=staffApi(db,'src/app/api/pedidos/[id]/route.ts')
 const response=await route.PATCH(new Request('https://test.invalid/api/pedidos/order',{method:'PATCH',body:JSON.stringify({itens:[{...db.rows.pedido_itens[0],quantidade:2}]})}),{params:Promise.resolve({id:'order'})})
 assert.equal(response.status,400);assert.equal(db.writes.length,0)
 const unchanged=await route.PATCH(new Request('https://test.invalid/api/pedidos/order',{method:'PATCH',body:JSON.stringify({itens:db.rows.pedido_itens,cliente_nome:'Changed'})}),{params:Promise.resolve({id:'order'})})
 assert.equal(unchanged.status,200)
})
