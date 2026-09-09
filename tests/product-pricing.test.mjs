import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as pricing from '../src/lib/product-pricing.ts'

const fixed = { id: 'fixed', preco: 20, exibir_preco_a_partir_de: false }
const reference = { id: 'reference', preco: 20, exibir_preco_a_partir_de: true }

test('explicit reference prices charge only complements; fixed and legacy prices retain base and variant', () => {
  assert.equal(pricing.chargedProductBase(reference, 7) + 18 + 4, 22)
  assert.equal(pricing.chargedProductBase(fixed, 7) + 18 + 4, 49)
  assert.equal(pricing.chargedProductBase({ preco: '20.50' }), 20.5)
  assert.equal(pricing.chargedProductBase({ preco: 20, exibir_preco_a_partir_de: null }, 7), 27)
})

test('restored carts remove the old reference charge without changing order snapshots', () => {
  const snapshot = [{ id: 'line', produto_id: 'reference', valor_unitario: 20, variante_preco: 7, quantidade: 2, complementos: [{ valor: 22, quantidade: 1 }] }]
  const cart = pricing.normalizeCartPrices(snapshot, [reference])
  assert.equal(cart[0].valor_unitario, 0)
  assert.equal(cart[0].variante_preco, 0)
  assert.equal(snapshot[0].valor_unitario, 20)
  assert.equal(cart[0].quantidade, 2)
  assert.deepEqual(cart[0].complementos, snapshot[0].complementos)
  assert.deepEqual(pricing.normalizeCartPrices(cart, [reference]), cart)
})

test('manual stale requests remove the reference once and preserve fixed items and adjustments', () => {
  const items = [{ produto_id: 'reference', valor_unitario: 20, quantidade: 2 }, { produto_id: 'fixed', valor_unitario: 20, quantidade: 1 }]
  const result = pricing.removeReferenceCharges(items, [reference, fixed])
  assert.equal(result.removed, 40)
  assert.equal(result.items[0].valor_unitario, 0)
  assert.equal(result.items[1].valor_unitario, 20)
  assert.equal(pricing.removeReferenceCharges(result.items, [reference, fixed]).removed, 0)
  assert.equal(items[0].valor_unitario, 20)
})

// Execute the real public route with an in-memory database. Never send test orders to production.
function publicRoute(product, complementPrice = 22) {
  let written
  const rows = {
    tenants: [{ id: 'shop', status: 'active', config: { loja_aberta: true } }],
    produtos: [{ ...product, nome: 'Meal', ativo: true }],
    complementos: [{ id: 'comp', nome: 'Selected meal', preco: complementPrice, ativo: true, categoria_id: 'group', qtd_max: 5 }],
    produto_complementos: [{ produto_id: product.id, complemento_id: 'comp' }],
    categorias_complementos: [{ id: 'group', qtd_minima: 1, qtd_maxima: 5 }],
    clientes: [], pedidos: [], variantes: [],
  }
  const admin = {
    from(table) {
      assert.ok(table in rows, `Unexpected table ${table}`)
      let singular = false
      const chain = {
        select() { return chain }, eq() { return chain }, in() { return chain }, limit() { return chain },
        single() { singular = true; return chain }, maybeSingle() { singular = true; return chain },
        then(resolve, reject) { return Promise.resolve({ data: singular ? rows[table][0] : rows[table], count: 0 }).then(resolve, reject) },
      }
      return chain
    },
    async rpc(name, args) {
      assert.equal(name, 'criar_pedido_atomico')
      written = args
      return { data: { id: 'order', codigo: '1', status: 'novo', ...args.p_pedido } }
    },
  }
  const imports = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@supabase/supabase-js': { createClient: () => admin },
    '@/lib/product-pricing': pricing,
    '@/lib/customer-identity': { rateLimited: async () => false, isValidCpf: () => true, hashAccessToken: value => value, normalizeCpf: value => value, tokenMatches: () => true },
  }
  const source = readFileSync(new URL('../src/app/api/pedidos/public/route.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] }, process: { env: {} }, console, Headers, Response, URL }
  vm.runInNewContext(compiled, context)
  return { POST: context.exports.POST, written: () => written }
}

for (const [label, product, quantity, total] of [
  ['reference', reference, 1, 22], ['fixed', fixed, 1, 42],
  ['two reference meals', reference, 2, 44], ['two fixed meals', fixed, 2, 84],
]) {
  test(`public API persists correct ${label} total using catalog values, not browser prices`, async () => {
    const route = publicRoute(product)
    const response = await route.POST(new Request('https://test.invalid/api/pedidos/public', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'k'.repeat(32) },
      body: JSON.stringify({ tenant_slug: 'shop', cliente_nome: 'Test', cliente_whatsapp: '85999999999', cliente_access_token: 't'.repeat(32), tipo_entrega: 'retirada',
        itens: [{ produto_id: product.id, quantidade: quantity, valor_unitario: 999, complementos: [{ id: 'comp', quantidade: 1, valor: 999 }] }],
        valor_total: 999, formas_pagamento: [{ forma: 'dinheiro', valor: total }],
      }),
    }))
    const body = await response.json()
    assert.equal(response.status, 200, JSON.stringify(body))
    assert.equal(body.valor_total, total)
    assert.equal(route.written().p_pedido.valor_subtotal, total)
    assert.equal(route.written().p_itens[0].valor_unitario, product.exibir_preco_a_partir_de ? 0 : 20)
    assert.equal(route.written().p_itens[0].complementos[0].valor, 22)
  })
}

test('printed and tracked totals include extras with zero base and support old snapshots', () => {
  assert.equal(pricing.savedItemTotal({ valor_unitario: 0, quantidade: 2, complementos: [{ valor: 22, quantidade: 1 }] }), 44)
  assert.equal(pricing.savedItemTotal({ valor_unitario: 20, quantidade: 2, complementos: JSON.stringify([{ preco: 22 }]) }), 84)
  assert.equal(pricing.savedItemTotal({ valor_unitario: 20, quantidade: 1 }), 20)
})
