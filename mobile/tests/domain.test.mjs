import test from 'node:test'
import assert from 'node:assert/strict'
import { addons, canUseStore, dateRange, money, oauthCode } from '../src/domain.ts'
test('Yesterday crosses month and year boundaries using calendar dates', () => {
  const r = dateRange('ontem', new Date(2026, 0, 1, 0, 1))
  const a = new Date(r.from), b = new Date(r.until)
  assert.equal(a.getFullYear(), 2025); assert.equal(a.getMonth(), 11); assert.equal(a.getDate(), 31)
  assert.equal(a.getHours(), 0); assert.equal(b.getDate(), 1); assert.equal(b.getFullYear(), 2026)
})
test('Date interval has exclusive next midnight', () => {
  const r = dateRange('hoje', new Date(2026, 9, 30, 23, 59))
  assert.equal(new Date(r.until).getDate(), 31); assert.equal(new Date(r.until).getHours(), 0)
})
test('Only active and unblocked stores can open', () => {
  for (const status of ['pending_approval','suspended','inactive']) assert.equal(canUseStore({status,bloqueado:false}),false)
  assert.equal(canUseStore({ status: 'active', bloqueado: true }), false)
  assert.equal(canUseStore({ status: 'active', bloqueado: false }), true)
})
test('Stored item complements do not duplicate relational complements', () => {
  const result = addons({ pedido_complementos: [{ nome: 'Granola', quantidade: 2 }], complementos: [{ nome: 'Granola', quantidade: 2 }] })
  assert.equal(result.length,1);assert.equal(result[0].quantidade,2)
})
test('Legacy complement JSON is supported and malformed entries ignored', () => {
  assert.deepEqual(addons({pedido_complementos:[],complementos:[null,{nome:'Banana'},'invalid']}),[{nome:'Banana',quantidade:1}])
  assert.deepEqual(addons({pedido_complementos:[],complementos:{}}),[])
})
test('OAuth uses only the exact app callback and rejects token substitution', () => {
  const callback='wedelivery://auth/callback'
  assert.equal(oauthCode(callback+'?code=verified',callback),'verified')
  for(const url of ['https://evil.example/?code=x','wedelivery://other/callback?code=x','wedelivery://auth/callback/other?code=x','wedelivery://auth/callback#access_token=forged','wedelivery://auth/callback?error=denied']) assert.throws(()=>oauthCode(url,callback))
})
test('Saved order total is displayed as supplied, not recalculated',()=>assert.match(money('32.50'),/32,50/))
