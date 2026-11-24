import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { formatarNomeProprio } from '../src/lib/nome-proprio.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('customer names get the first letter of every word in upper case', () => {
  assert.equal(formatarNomeProprio('joão da silva'), 'João Da Silva')
  assert.equal(formatarNomeProprio('  MARIA   clara  '), 'Maria Clara')
  assert.equal(formatarNomeProprio('ana-beatriz d\'ávila'), 'Ana-Beatriz D\'Ávila')
  assert.equal(formatarNomeProprio('érica çaçá'), 'Érica Çaçá')
  assert.equal(formatarNomeProprio(null), '')
})

test('special opening dates are gone from settings and from the opening-hours cron', () => {
  const settings = read('../src/app/(dashboard)/configuracoes/page.tsx')
  assert.doesNotMatch(settings, />Datas especiais<|addExcecao|novaExcecao/)
  assert.match(settings, /excecoes_horario: \[\]/)
  assert.match(read('../src/app/api/cron/atualizar-horarios/route.ts'), /verificarHorarioFuncionamento\(config\.horarios_dias, \[\]\)/)
})

test('number fields that used to keep a stuck zero use NumericInput', () => {
  const settings = read('../src/app/(dashboard)/configuracoes/page.tsx')
  assert.doesNotMatch(settings, /taxa:Number\(e\.target\.value\)|setTrocoMax\(parseFloat|Number\(e\.target\.value\) \|\| 0/)
  assert.doesNotMatch(read('../src/components/admin/marketing/FidelidadeTab.tsx'), /:Number\(e\.target\.value\)\}\)\}\/>/)
  const input = read('../src/components/numeric-input.tsx')
  assert.ok(input.includes("replace(/^0+(?=\\d)/, '')"), 'strips leading zeros while typing')
})

test('cart always opens on the item list and offers "Finalizar pedido"', () => {
  const checkout = read('../src/components/checkout-flow.tsx')
  assert.match(checkout, /current === 'confirmacao' \? current : startAtCustomer \? 'cliente' : 'carrinho'/)
  assert.match(checkout, /Finalizar pedido/)
  assert.doesNotMatch(read('../src/components/cardapio-cliente.tsx'), /setCheckoutDireto\(true\)/)
})

test('abandoned carts are written by the server and the public write policies are dropped', () => {
  const menu = read('../src/components/cardapio-cliente.tsx')
  assert.match(menu, /\/api\/carrinho\/salvar/)
  const route = read('../src/app/api/carrinho/salvar/route.ts')
  assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(route, /onConflict: 'tenant_id,session_id'/)
  const migration = read('../supabase/migrations/20261124182000_carrinho_abandonado_ativo.sql')
  assert.match(migration, /DROP POLICY IF EXISTS "Publico pode atualizar carrinho"/)
})

test('retroactive cashback is idempotent and restricted to owner/manager', () => {
  const sql = read('../supabase/migrations/20261124181000_cashback_retroativo.sql')
  assert.match(sql, /ON CONFLICT \(pedido_id\) DO NOTHING/)
  assert.match(sql, /role IN \('owner', 'manager'\)/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.aplicar_cashback_retroativo\(uuid\) FROM PUBLIC, anon/)
})

test('customer profile shows cashback only when the store has it on', () => {
  const account = read('../src/components/customer-account.tsx')
  assert.match(account, /const cashbackVisivel = cashback \? cashback\.ativo : cashbackAtivo/)
  assert.match(account, /formatCurrency\(saldoCashback\)/)
})
