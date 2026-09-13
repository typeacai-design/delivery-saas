import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, rm, rmdir, access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const routeDir = path.join(root,'src/app/flavors-admin-validation-local')
const route = path.join(routeDir,'page.tsx')
const outDir = path.join(root,'.local-validation/flavor-admin')
const url = 'http://127.0.0.1:3111/flavors-admin-validation-local'
const runtime = process.env.PLAYWRIGHT_RUNTIME || path.join(process.env.USERPROFILE || '', '.dev-browser/node_modules/playwright/index.mjs')
const { chromium } = await import(pathToFileURL(runtime).href)
let server, browser, routeCreated=false
let output = ''
const checks=[]
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS',name) }
async function waitForServer() { for (let i=0;i<90;i++) { try { const r=await fetch(url); if(r.ok)return }catch{}; await new Promise(r=>setTimeout(r,1000)) } throw new Error('Dev server unavailable: '+output.slice(-3000)) }
try {
 try { await access(routeDir); throw new Error('Refusing to overwrite existing validation route') } catch(e) { if(e.code!=='ENOENT')throw e }
 await mkdir(routeDir,{recursive:true}); routeCreated=true; await mkdir(outDir,{recursive:true})
 await writeFile(route,await readFile(path.join(root,'tests/fixtures/flavor-admin/page.tsx.fixture')))
 console.log('TEMPORARY ROUTE ACTIVE',route)
 server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3111'],{cwd:root,windowsHide:true,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-local-only',SUPABASE_SERVICE_ROLE_KEY:'synthetic-local-only'}})
 server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d)
 await waitForServer()
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:1280,height:900}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')output+='\nBROWSER '+m.text()})
 let configReads=0
 const productWrites=[], configWrites=[], linkWrites=[]
 const flavors=[{id:'calabresa',nome:'Calabresa',preco:30,categoria_id:'sabores'},{id:'frango',nome:'Frango',preco:36,categoria_id:'sabores'},{id:'portuguesa',nome:'Portuguesa',preco:39,categoria_id:'sabores'}]
 await page.route('**/*',async route=>{
   const req=route.request(), u=new URL(req.url()), method=req.method()
   const fulfill=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
   if(u.pathname==='/api/auth/meu-tenant')return fulfill({id:'tenant',config:{}})
   if(u.pathname==='/api/auth/session')return fulfill({tenant:{id:'tenant'}})
   if(u.pathname==='/api/configuracoes/sabores'){
     if(method==='PUT'){const body=req.postDataJSON();configWrites.push(body);return fulfill(body)}
     configReads++;return fulfill({sabores_ativo:false,produtos:[{id:'pizza',nome:'Pizza Teste'}]})
   }
   if(u.pathname.startsWith('/rest/v1/')){
     const table=u.pathname.split('/').at(-1)
     if(method!=='GET'){
       if(table==='produtos')productWrites.push(req.postDataJSON())
       if(table==='produto_complementos')linkWrites.push(req.postDataJSON())
       return fulfill([])
     }
     return fulfill(table==='tenants'?{slug:''}:table==='complementos'?flavors:table==='categorias_complementos'?[{id:'sabores',nome:'Escolha sabor',descricao:' Pizza grande '},{id:'pequena',nome:'Escolha sabor',descricao:'Pizza pequena'},{id:'extras',nome:'Extras',descricao:'   '}]:[])
   }
   if(u.hostname==='127.0.0.1'&&method==='GET')return route.continue()
   return route.abort()
 })
 await page.goto(url)
 const open=async()=>{await page.getByRole('button',{name:'Open product',exact:true}).click();await page.getByText('Divisão em sabores',{exact:true}).waitFor();await page.waitForTimeout(500)}
 const save=async n=>{await page.getByRole('button',{name:'Salvar item',exact:true}).click();await page.waitForFunction(n=>document.querySelector('[data-testid="saved"]').textContent===String(n),n)}
 await check('ordinary product preserves inactive flavor configuration and prices',async()=>{await open();await save(1);assert.equal(productWrites.at(-1).sabores_grupo_id,null);assert.equal(productWrites.at(-1).sabores_maximo,2);assert.equal(productWrites.at(-1).preco,30)})
 await check('product opt-in works without global settings and cancel sends no mutations',async()=>{
   await open();const toggle=page.getByRole('checkbox',{name:'Permitir escolher mais de um sabor neste produto'});
   assert.equal(await toggle.isDisabled(),false);await toggle.check();
   const before=JSON.stringify([productWrites,linkWrites,configWrites]);
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();
   assert.equal(JSON.stringify([productWrites,linkWrites,configWrites]),before);assert.equal(configReads,0)
 })
 await check('same group titles show distinct internal descriptions and empty description falls back',async()=>{
   await open();await page.getByRole('checkbox',{name:'Permitir escolher mais de um sabor neste produto'}).check();
   const section=page.getByText('Divisão em sabores',{exact:true}).locator('..').locator('..');
   const options=await section.locator('select').nth(0).locator('option').allTextContents();
   assert(options.includes('Escolha sabor — Pizza grande'));assert(options.includes('Escolha sabor — Pizza pequena'));assert(options.includes('Extras'));
 })
 await check('invalid flavor configuration does not save or activate the store',async()=>{
   const before=productWrites.length;await page.getByRole('button',{name:'Salvar item',exact:true}).click();
   await page.getByText('Escolha uma lista com ao menos o limite de sabores ativos configurado.',{exact:true}).waitFor();
   assert.equal(productWrites.length,before);assert.equal(configWrites.length,0);
 })
 await check('one product save links flavors and sends no separate store activation',async()=>{
   const section=page.getByText('Divisão em sabores',{exact:true}).locator('..').locator('..');
   await section.locator('select').nth(0).selectOption('sabores');await section.locator('select').nth(1).selectOption('3');await save(2);
   assert.equal(productWrites.at(-1).sabores_grupo_id,'sabores');assert.equal(productWrites.at(-1).sabores_maximo,3);assert.equal(productWrites.at(-1).preco,30);
   assert.equal(linkWrites.at(-1).length,3);assert.equal(configWrites.length,0);assert.equal(configReads,0);
 })
 await page.getByRole('combobox',{name:'Fixture'}).selectOption('settings')
 await check('actual settings page has no flavors tab',async()=>{
   await page.getByRole('button',{name:'Entregas',exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Sabores',exact:true}).count(),0);
   assert.equal(await page.getByRole('checkbox',{name:'Ativar divisão em sabores nesta loja'}).count(),0)
 })
 assert.deepEqual(errors,[])
 await writeFile(path.join(outDir,'results.json'),JSON.stringify({checks,runtimeErrors:errors},null,2))
 console.log(JSON.stringify({passed:checks.length,artifacts:outDir}))

} finally {
 await browser?.close()
 if(server) { if(process.platform==='win32') await new Promise(resolve=>spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).once('close',resolve)); else server.kill() }
 if(routeCreated) {await rm(route,{force:true}); await rmdir(routeDir).catch(()=>{})}
 for (const name of ['validator.ts','routes.d.ts']) { const generated=path.join(root,'.next/dev/types',name); try {if((await readFile(generated,'utf8')).includes('flavors-admin-validation-local'))await rm(generated)} catch {} }
 await writeFile(path.join(outDir,'server.log'),output).catch(()=>{})
 console.log('TEMPORARY ROUTE REMOVED')
}
