import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
async function tenant(options={}){
 const source=await fs.readFile(new URL('../src/lib/tenant-auth.ts',import.meta.url),'utf8'),reads=[]
 const client={auth:{getUser:async()=>({data:{user:options.user===false?null:{id:'user'}},error:null})},from(table){reads.push(table);let q={select(){return q},eq(){return q},maybeSingle(){return q},then(resolve){return Promise.resolve({data:table==='usuarios_loja'?(options.members||[{tenant_id:'a',role:'owner',ativo:true},{tenant_id:'b',role:'manager',ativo:true}]):{status:options.status||'active'}}).then(resolve)}};return q}}
 const context=vm.createContext({}),module=new vm.SourceTextModule(stripTypeScriptTypes(source),{context})
 await module.link(async spec=>{const exports=spec==='next/headers'?{headers:async()=>new Headers(options.headers||{}),cookies:async()=>({get:key=>key==='wd_active_tenant'&&options.cookie?{value:options.cookie}:undefined})}:{createClient:async()=>client};return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context})});await module.evaluate();return {api:module.namespace,reads}
}
test('Native authorization requires explicit active store selection',async()=>{const h=await tenant({headers:{authorization:'Bearer verified'}});const a=await h.api.authenticatedTenant(['owner','manager']);assert.equal(a.tenantId,null);assert.deepEqual(h.reads,['usuarios_loja'])})
test('Invalid explicit selection never silently falls back to another store',async()=>{const h=await tenant({headers:{authorization:'Bearer verified','x-wd-tenant-id':'foreign'}});assert.equal((await h.api.authenticatedTenant(['owner','manager'])).tenantId,null)})
test('Native selected store is checked for membership and permitted role',async()=>{const h=await tenant({headers:{authorization:'Bearer verified','x-wd-tenant-id':'b'}});assert.equal((await h.api.authenticatedTenant(['owner','manager'])).tenantId,'b');assert.equal((await h.api.authenticatedTenant(['owner'])).tenantId,null)})
test('Invalid identity and inactive stores cannot authorize writes',async()=>{for(const option of [{user:false},{status:'blocked'}]){const h=await tenant({...option,headers:{authorization:'Bearer invalid','x-wd-tenant-id':'a'}});assert.equal((await h.api.authenticatedTenant()).tenantId,null)}})
test('Browser cookie selection remains supported',async()=>{const h=await tenant({cookie:'b'});assert.equal((await h.api.authenticatedTenant(['owner','manager'])).tenantId,'b')})
async function serverClient(options={}){
 const source=await fs.readFile(new URL('../src/lib/supabase/server.ts',import.meta.url),'utf8'),captured=[]
 const context=vm.createContext({process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'publishable-test'}}}),module=new vm.SourceTextModule(stripTypeScriptTypes(source),{context})
 const cookieValues=[{name:'sb-test-auth-token',value:'browser-cookie'}]
 await module.link(async spec=>{const exports=spec==='next/headers'?{headers:async()=>new Headers(options.headers||{}),cookies:async()=>({getAll:()=>cookieValues,set:()=>{throw new Error('Native flow cannot modify browser cookies')}})}:{createServerClient:(url,key,settings)=>{captured.push(settings);return settings}};return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context})});await module.evaluate();const settings=await module.namespace.createClient();return {settings,cookieValues}
}
test('Bearer clients cannot consume a browser session or write browser cookies',async()=>{const {settings}=await serverClient({headers:{authorization:'Bearer native-token'}});assert.equal(settings.global.headers.Authorization,'Bearer native-token');assert.equal(settings.cookies.getAll().length,0);assert.doesNotThrow(()=>settings.cookies.setAll([{name:'unexpected',value:'bad',options:{}}]))})
test('Cookie-only browser clients preserve existing session transport',async()=>{const {settings,cookieValues}=await serverClient();assert.equal(settings.global,undefined);assert.equal(settings.cookies.getAll(),cookieValues)})
