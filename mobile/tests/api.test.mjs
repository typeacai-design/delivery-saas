import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as domain from '../src/domain.ts'

function setup({ user = { id: 'owner' }, memberships = [{ tenant_id: 'store-a', role: 'owner' }], failure = '', productPages = [] } = {}) {
  const calls = [], tables = []
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) }, from(table) {
    tables.push(table); let offset = 0
    const q = new Proxy({}, { get(_target, method) {
      if (method === 'then') return resolve => resolve(failure === table ? { error: new Error('denied') } : { data: table === 'usuarios_loja' ? memberships : table === 'tenants' ? memberships.map(m => ({ id: m.tenant_id, nome: m.tenant_id })) : table === 'produtos' ? (productPages[offset / 100] || []) : [], count: 72, error: null })
      return (...args) => { calls.push({ table, method, args }); if (method === 'range') offset = args[0]; return q }
    } })
    return q
  } }
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/api.ts', import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports, require: name => name === './supabase' ? { supabase: client } : domain, AbortController })
  return { api: exports, calls, tables }
}
const signal = () => new AbortController().signal
test('An absent verified user cannot read memberships or orders through bootstrap',async()=>{const h=setup({user:null});await assert.rejects(h.api.stores(signal()));assert.equal(h.tables.length,0)})
test('A membership lookup failure is not reported as an empty successful account',async()=>{const h=setup({failure:'usuarios_loja'});await assert.rejects(h.api.stores(signal()));assert.deepEqual(h.tables,['usuarios_loja'])})
test('An account without memberships never reads store profiles',async()=>{const h=setup({memberships:[]});assert.equal((await h.api.stores(signal())).length,0);assert.deepEqual(h.tables,['usuarios_loja'])})
test('Multiple stores are returned for explicit selection without automatic first-store fallback',async()=>{const h=setup({memberships:[{tenant_id:'a'},{tenant_id:'b'}]});const result=await h.api.stores(signal());assert.equal(result.length,2);const constraint=h.calls.find(x=>x.table==='tenants'&&x.method==='in');assert.deepEqual(Array.from(constraint.args[1]),['a','b'])})
test('Order pagination is scoped to store and excludes removed orders',async()=>{const h=setup();await h.api.orders('store-b','ontem','novo',2,signal());assert.ok(h.calls.some(x=>x.method==='eq'&&x.args[0]==='tenant_id'&&x.args[1]==='store-b'));assert.ok(h.calls.some(x=>x.method==='is'&&x.args[0]==='deleted_at'&&x.args[1]===null));const range=h.calls.find(x=>x.method==='range');assert.deepEqual(Array.from(range.args),[50,74]);assert.ok(h.calls.some(x=>x.method==='lt'&&x.args[0]==='data_criacao'))})
test('Denied order reads never become a misleading empty-order screen',async()=>{const h=setup({failure:'pedidos'});await assert.rejects(h.api.orders('store-a','hoje','novo',0,signal()))})
test('Catalog reads every page instead of silently dropping later products',async()=>{const h=setup({productPages:[Array.from({length:100},(_,id)=>({id})),[{id:100}]]});const result=await h.api.catalog('store-a',signal());assert.equal(result.products.length,101);assert.equal(h.calls.filter(x=>x.table==='produtos'&&x.method==='range').length,2)})
