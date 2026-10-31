import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'
import vm from 'node:vm'
const code=ts.transpileModule(fs.readFileSync('src/entities.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const modelCode=ts.transpileModule(fs.readFileSync('src/product-model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const model={exports:{}};vm.runInNewContext(modelCode,model)
const context={exports:{},require:name=>name==='./product-model'?model.exports:{supabase:{}}};vm.runInNewContext(code,context)
const {entities,entityPayload}=context.exports
const defaults=entity=>Object.fromEntries(entity.fields.map(f=>[f.key,f.initial??'']))
test('Coupons use the existing fixed-discount code and reject excessive percentage',()=>{const f={...defaults(entities.coupons),codigo:' teste ',tipo:'valor_fixo',valor:20,validade:'2027-01-15'};assert.equal(entityPayload(entities.coupons,f).tipo,'valor_fixo');assert.equal(entityPayload(entities.coupons,f).codigo,'TESTE');assert.throws(()=>entityPayload(entities.coupons,{...f,tipo:'percentual',valor:101}))})
test('Customer data normalizes phone but never adds server fields',()=>{const payload=entityPayload(entities.clients,{...defaults(entities.clients),nome:'Test',telefone:'(47) 99999-9999',tenant_id:'foreign'});assert.equal(payload.telefone,'47999999999');assert.equal(payload.tenant_id,undefined)})
test('Complement list rejects minimum above maximum',()=>assert.throws(()=>entityPayload(entities.lists,{...defaults(entities.lists),nome:'Frutas',qtd_minima:3,qtd_maxima:2})))
