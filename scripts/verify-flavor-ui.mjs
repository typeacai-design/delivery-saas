import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mockCatalog } from '../tests/fixtures/flavor-ui/catalog.mjs'
import { readFile, writeFile, mkdir, rm, rmdir, access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const routeDir = path.join(root,'src/app/flavors-validation-local')
const route = path.join(routeDir,'page.tsx')
const outDir = path.join(root,'.local-validation/flavor-ui')
const url = 'http://127.0.0.1:3110/flavors-validation-local'
const runtime = process.env.PLAYWRIGHT_RUNTIME || path.join(process.env.USERPROFILE || '', '.dev-browser/node_modules/playwright/index.mjs')
const { chromium } = await import(pathToFileURL(runtime).href)
let server, browser, mockServer, routeCreated=false
let output = ''
const checks=[]
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS',name) }
async function waitForServer() { for (let i=0;i<90;i++) { try { const r=await fetch(url); if(r.ok)return }catch{}; await new Promise(r=>setTimeout(r,1000)) } throw new Error('Dev server unavailable: '+output.slice(-3000)) }
try {
 try { await access(routeDir); throw new Error('Refusing to overwrite existing validation route') } catch(e) { if(e.code!=='ENOENT')throw e }
 await mkdir(routeDir,{recursive:true}); routeCreated=true; await mkdir(outDir,{recursive:true})
 await writeFile(route,await readFile(path.join(root,'tests/fixtures/flavor-ui/page.tsx.fixture')))
 console.log('TEMPORARY ROUTE ACTIVE',route)
 mockServer=createServer((request,response)=>{
  if(request.method!=='GET'){response.writeHead(405);response.end();return}
  const u=new URL(request.url,'http://127.0.0.1:3111')
  response.setHeader('Content-Type','application/json');response.end(JSON.stringify(mockCatalog(u.pathname.split('/').at(-1),u.searchParams)))
 })
 await new Promise((resolve,reject)=>{mockServer.once('error',reject);mockServer.listen(3111,'127.0.0.1',resolve)})
 server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3110'],{cwd:root,windowsHide:true,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3111',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-local-only',SUPABASE_SERVICE_ROLE_KEY:'synthetic-local-only'}})
 server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d)
 await waitForServer()
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:1280,height:900}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')output+='\nBROWSER '+m.text()})
 await page.route('**/*',route=> { const r=route.request(); return new URL(r.url()).hostname==='127.0.0.1' && r.method()==='GET' ? route.continue() : route.abort() })
 await page.goto(url); await page.getByRole('button',{name:'Open product',exact:true}).waitFor()
 const dialog=page.getByRole('dialog')
 const choose=async n=> { await page.getByRole('button',{name:'Open product',exact:true}).click(); await dialog.getByRole('button',{name:new RegExp('^'+n+' sabor')}).click() }
 const select=async name=>dialog.getByRole('button',{name:'Selecionar '+name,exact:true}).click()
 const next=async()=>dialog.getByRole('button',{name:'Continuar',exact:true}).click()
 const items=async()=>JSON.parse(await page.getByTestId('items').innerText())
 const total=i=>Math.round((i.valor_unitario+(i.variante_preco||0)+i.complementos.reduce((s,c)=>s+c.valor*c.quantidade,0))*i.quantidade*100)/100
 const clear=async()=>page.getByRole('button',{name:'Clear',exact:true}).click()
 await check('one flavor replaces product base',async()=>{await choose(1);await select('Frango');assert.equal(await dialog.getByRole('button',{name:'Selecionar Calabresa',exact:true}).isDisabled(),true);await next();await next();const [i]=await items();assert.equal(total(i),36);assert.equal(i.valor_unitario,0);assert.equal(i.sabores_quantidade,1);assert.equal(i.complementos[0].preco_integral,36)})
 await clear()
 await check('two flavors mean plus full-price extras',async()=>{await choose(2);await select('Calabresa');assert.equal(await dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled(),true);await select('Frango');await next();assert.equal(await dialog.getByRole('heading',{name:'Adicionais',exact:true}).count(),1);await select('Borda recheada');await dialog.screenshot({path:path.join(outDir,'desktop-two-flavors.png')});await next();const [i]=await items();assert.equal(total(i),41);assert.equal(i.complementos.filter(c=>c.tipo==='sabor').length,2);assert.equal(i.complementos.find(c=>c.id==='borda').valor,8);assert.match(await page.getByTestId('labels').innerText(),/1\/2 Calabresa/)})
 await check('same product different compositions remain independent',async()=>{await choose(1);await select('Portuguesa');await next();await next();const result=await items();assert.equal(result.length,2);assert.notEqual(result[0].id,result[1].id);assert.equal(total(result[0]),41);assert.equal(total(result[1]),39)})
 await clear()
 await check('three flavors mean rounds once; limit forbids duplicates',async()=>{await choose(3);await select('Calabresa');assert.equal(await dialog.getByRole('button',{name:'Selecionar Calabresa',exact:true}).isDisabled(),true);await select('Frango');await select('Portuguesa');await next();await next();const [i]=await items();assert.equal(total(i),35);assert.equal(i.sabores_quantidade,3);assert.ok(i.complementos.every(c=>c.quantidade===1&&c.fracao_denominador===3&&c.regra_preco==='media_v1'))})
 await clear()
 await check('back to count clears old selection',async()=>{await choose(2);await select('Calabresa');await select('Frango');await dialog.getByRole('button',{name:'Voltar',exact:true}).click();await dialog.getByRole('button',{name:/^1 sabor/}).click();assert.equal(await dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled(),true);await select('Portuguesa');await next();await next();assert.equal(total((await items())[0]),39)})
 await clear()
 await page.getByRole('combobox',{name:'Fixture'}).selectOption('two')
 await check('per-product maximum hides third option',async()=>{await page.getByRole('button',{name:'Open product',exact:true}).click();assert.equal(await dialog.getByRole('button',{name:/^3 sabores/}).count(),0);await dialog.getByRole('button',{name:'Fechar',exact:true}).click()})
 for(const mode of ['disabled','variants','stock']) {await page.getByRole('combobox',{name:'Fixture'}).selectOption(mode);await check(mode+' prevents selection and cart insertion',async()=>{await page.getByRole('button',{name:'Open product',exact:true}).click();assert.equal(await dialog.getByRole('alert').count(),1);assert.equal(await dialog.getByRole('button',{name:'Continuar',exact:true}).count(),0);await dialog.getByRole('button',{name:'Fechar',exact:true}).click()})}
 for(const [mode,expected] of [['fixed',108],['reference',8]]) {await page.getByRole('combobox',{name:'Fixture'}).selectOption(mode);await check(mode+' existing pricing preserved',async()=>{await page.getByRole('button',{name:'Open product',exact:true}).click();await select('Borda recheada');await next();assert.equal(total((await items()).at(-1)),expected)})}
 await clear();await page.getByRole('combobox',{name:'Fixture'}).selectOption('flavors');await page.setViewportSize({width:390,height:844})
 await check('mobile count and exact flavor selection',async()=>{await page.getByRole('button',{name:'Open product',exact:true}).click();await dialog.screenshot({path:path.join(outDir,'mobile-count.png')});await dialog.getByRole('button',{name:/^3 sabores/}).click();await select('Calabresa');await select('Frango');await select('Portuguesa');await dialog.screenshot({path:path.join(outDir,'mobile-three-flavors.png')});await next();await next();assert.equal(total((await items())[0]),35)})
 await check('actual public server page forwards enabled flag and displays cheapest flavor without search',async()=>{
  await page.goto('http://127.0.0.1:3110/cardapio/local-on')
  await page.getByRole('heading',{name:'Pizza Grande',exact:true}).waitFor()
  const text=await page.locator('body').innerText()
  assert.match(text,/30,00/);assert.doesNotMatch(text,/100,00/)
  await page.getByRole('heading',{name:'Pizza Grande',exact:true}).click()
  await dialog.getByRole('button',{name:/^2 sabores/}).click()
  await select('Calabresa');await select('Frango');await next();await next()
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('delivery_carrinho_local-on')||'[]').length===1)
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('delivery_carrinho_local-on')))
  assert.equal(total(stored[0]),33);assert.equal(stored[0].sabores_quantidade,2)
  await page.screenshot({path:path.join(outDir,'actual-catalog-cart.png'),fullPage:true})
 })
 await check('valid stored flavor cart survives reload without base charge',async()=>{
  await page.reload()
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('delivery_carrinho_local-on')||'[]').length===1)
  await page.getByRole('button',{name:'Abrir carrinho',exact:true}).click()
  assert.match(await dialog.innerText(),/33,00/)
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('delivery_carrinho_local-on')))
  assert.equal(total(stored[0]),33)
 })
 await check('stale flavor prices require reselection with visible notice',async()=>{
  await page.evaluate(()=>{const key='delivery_carrinho_local-on';const data=JSON.parse(localStorage.getItem(key));data[0].complementos[0].preco_integral=999;localStorage.setItem(key,JSON.stringify(data))})
  await page.reload();await page.getByRole('alert').filter({hasText:'A montagem de uma pizza mudou'}).waitFor()
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('delivery_carrinho_local-on')).length),0)
 })
 for(const slug of ['local-modern','local-minimal']) await check('actual '+slug+' catalog uses flavor price and selector',async()=>{
  await page.goto('http://127.0.0.1:3110/cardapio/'+slug)
  const title=page.getByRole('heading',{name:'Pizza Grande',exact:true});await title.waitFor()
  assert.match(await page.locator('body').innerText(),/30,00/)
  await title.click();await dialog.getByRole('button',{name:/^3 sabores/}).waitFor()
 })
 await check('actual public server master-off hides configured product without search',async()=>{
  await page.goto('http://127.0.0.1:3110/cardapio/local-off')
  assert.equal(await page.getByRole('heading',{name:'Pizza Grande',exact:true}).count(),0)
  assert.doesNotMatch(await page.locator('body').innerText(),/100,00/)
 })
 assert.deepEqual(errors,[],'No runtime errors')
 await writeFile(path.join(outDir,'results.json'),JSON.stringify({checks,runtimeErrors:errors},null,2))
 console.log(JSON.stringify({passed:checks.length,artifacts:outDir}))
} finally {
 await browser?.close()
 if(mockServer) await new Promise(resolve=>mockServer.close(resolve))
 if(server) { if(process.platform==='win32') await new Promise(resolve=>spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).once('close',resolve)); else server.kill() }
 if(routeCreated) {
  await rm(route,{force:true}); await rmdir(routeDir).catch(()=>{})
  for(const file of ['validator.ts','routes.d.ts']) {const generated=path.join(root,'.next/dev/types',file);const content=await readFile(generated,'utf8').catch(()=>'');if(content.includes('flavors-validation-local'))await rm(generated,{force:true})}
 }
 await writeFile(path.join(outDir,'server.log'),output).catch(()=>{})
 console.log('TEMPORARY ROUTE REMOVED')
}
