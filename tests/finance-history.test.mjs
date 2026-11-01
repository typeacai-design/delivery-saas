import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import {currentMonthRange} from '../src/lib/finance-period.ts'
function compile(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL,Date,Response,console,process:{env:{}},require:name=>{if(!(name in imports))throw Error(name);return imports[name]}});return exports}
const response={NextResponse:{json:(data,init)=>Response.json(data,init)}}
function fixture(allowed=true){const calls=[],db={rpc:async(name,args)=>{calls.push({name,args});return {data:{received:10,receivable:5,balance:10},error:null}},from(table){const query={select(){return query},eq(...args){calls.push({filter:args});return query},single:async()=>({data:{id:'own',config:{}},error:null}),insert:async body=>{calls.push({table,body});return {error:null}},update(body){calls.push({table,update:body});return query},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return query}};const auth={authenticatedTenant:async()=>({tenantId:allowed?'own':null,supabase:db,user:allowed?{id:'user'}:null}),tenantAuthStatus:a=>a.tenantId?null:401};return {calls,imports:{'next/server':response,'@/lib/tenant-auth':auth,'@supabase/supabase-js':{createClient:()=>{throw Error('Privileged client not needed')}}}}}
test('Finance read uses authenticated tenant, bounded pagination and calendar dates; denial prevents RPC',async()=>{
 const h=fixture(),api=compile('src/app/api/financeiro/route.ts',h.imports);const response=await api.GET(new Request('https://test/api/financeiro?view=resumo&from=2026-11-01&to=2026-11-30&tenant_id=foreign'));assert.equal(response.status,200);assert.equal((await response.json()).received,10);const rpc=h.calls[0];assert.equal(rpc.args.p_tenant_id,'own');assert.equal(rpc.args.p_limit,50);assert.equal(rpc.args.p_from,'2026-11-01');assert.equal(rpc.args.p_to,'2026-11-30');
 const denied=fixture(false);assert.equal((await compile('src/app/api/financeiro/route.ts',denied.imports).GET(new Request('https://test/api/financeiro?view=fluxo'))).status,403);assert.equal(denied.calls.length,0);
 assert.equal((await api.GET(new Request('https://test/api/financeiro?view=fluxo&offset=-1'))).status,400);
})
test('Manual accounts ignore supplied tenant/paid flags and repeated receipt is explicit conflict',async()=>{
 const h=fixture(),api=compile('src/app/api/contas-receber/route.ts',h.imports),request=body=>new Request('https://test/api/contas-receber',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await api.POST(request({descricao:'Manual',valor:12.5,vencimento:'2026-11-10',tenant_id:'foreign',recebido:true}))).status,201);assert.deepEqual({...h.calls[0].body},{tenant_id:'own',descricao:'Manual',valor:12.5,vencimento:'2026-11-10'});
 assert.equal((await api.POST(request({descricao:'Invalid',valor:-1,vencimento:'2026-11-10'}))).status,400);
 assert.equal((await api.PATCH(request({id:'10000000-0000-4000-8000-000000000001'}))).status,409);assert.ok(h.calls.some(x=>x.filter?.[0]==='tenant_id'&&x.filter[1]==='own'));
})
test('Current month follows Sao Paulo midnight and leap years',()=>{assert.deepEqual(currentMonthRange(new Date('2026-11-01T02:59:59Z')),{from:'2026-10-01',to:'2026-10-31'});assert.deepEqual(currentMonthRange(new Date('2028-02-29T12:00:00Z')),{from:'2028-02-01',to:'2028-02-29'})})
test('Web history card hides details initially and opens via accessible summary',()=>{
 let open=false;const api=compile('src/components/merchant-history-order.tsx',{'react':{...React,useState:()=>[open,next=>{open=typeof next==='function'?next(open):next}]},'react/jsx-runtime':jsx,'lucide-react':{ChevronDown:()=>null},'@/lib/utils':{formatarCodigoPedido:(_id,_date,code)=>code}});const props={pedido:{id:'id',codigo:'001/26',cliente_nome:'Ana',data_criacao:'2026-11-02T02:15:00Z',status:'entregue'},statusLabel:'Entregue',children:'Expanded products'};
 let tree=api.default(props);assert.equal(tree.props.children[1],null);const summary=tree.props.children[0];assert.equal(summary.props['aria-expanded'],false);assert.ok(JSON.stringify(tree).includes('01/11/2026'));assert.ok(JSON.stringify(tree).includes('23:15'));summary.props.onClick();tree=api.default(props);assert.equal(tree.props.children[1],'Expanded products');assert.equal(tree.props.children[0].props['aria-expanded'],true);
})
