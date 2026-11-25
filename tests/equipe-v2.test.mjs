import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizarCelular, emailInternoEquipe, ehFuncaoEquipe, INICIO_FUNCAO } from '../src/lib/equipe.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const existe = path => fs.existsSync(new URL(path, import.meta.url))

test('staff identity is the phone number', () => {
  assert.equal(normalizarCelular('(11) 98765-4321'), '5511987654321')
  assert.equal(normalizarCelular('5511987654321'), '5511987654321')
  assert.equal(normalizarCelular('1133334444'), '551133334444')
  assert.equal(normalizarCelular('123'), null)
  assert.equal(emailInternoEquipe('5511987654321'), '5511987654321@equipe.wedelivery.internal')
  assert.ok(ehFuncaoEquipe('kitchen') && ehFuncaoEquipe('attendant') && ehFuncaoEquipe('motoboy'))
  assert.ok(!ehFuncaoEquipe('owner') && !ehFuncaoEquipe('delivery'))
  assert.deepEqual(INICIO_FUNCAO, { kitchen: '/acesso/cozinha', attendant: '/acesso/garcom', motoboy: '/acesso/motoboy' })
})

test('old staff system is gone', () => {
  for (const p of ['../src/lib/funcionario-auth.ts', '../src/app/api/membros-equipe/route.ts', '../src/app/api/auth/atendente-login/route.ts', '../src/app/atendimento/page.tsx', '../src/app/(dashboard)/equipes/page.tsx', '../src/app/(dashboard)/motoboys/page.tsx'])
    assert.ok(!existe(p), p)
  assert.match(read('../supabase/migrations/20261124200000_equipe_v2_base.sql'), /DROP TABLE IF EXISTS public\.membros_equipe CASCADE/)
})

test('every staff page checks the role on the server and staff never opens the merchant panel', () => {
  assert.match(read('../src/app/acesso/(app)/cozinha/page.tsx'), /exigirFuncao\('kitchen'\)/)
  assert.match(read('../src/app/acesso/(app)/cozinha/historico/page.tsx'), /exigirFuncao\('kitchen'\)/)
  assert.match(read('../src/app/acesso/(app)/garcom/page.tsx'), /exigirFuncao\('attendant'\)/)
  assert.match(read('../src/app/acesso/(app)/garcom/historico/page.tsx'), /exigirFuncao\('attendant'\)/)
  assert.match(read('../src/app/acesso/(app)/motoboy/page.tsx'), /exigirFuncao\('motoboy'\)/)
  assert.match(read('../src/app/(dashboard)/layout.tsx'), /if \(ehFuncaoEquipe\(role\)\) redirect\(INICIO_FUNCAO\[role\]\)/)
  assert.match(read('../src/lib/tenant-auth.ts'), /export const SALES_ROLES: TenantRole\[\] = \['owner', 'manager'\]/)
  assert.match(read('../src/app/api/pedidos/list/route.ts'), /authenticatedTenant\(MANAGEMENT_ROLES\)/)
})

test('kitchen never receives prices, phone or address', () => {
  const lib = read('../src/lib/equipe-pedidos.ts')
  const colunas = lib.match(/COLUNAS_PEDIDO_EQUIPE = '([^']+)'/)[1]
  for (const proibido of ['valor', 'whatsapp', 'endereco', 'telefone', 'bairro']) assert.ok(!colunas.includes(proibido), proibido)
  assert.match(lib, /select\('pedido_id, nome, quantidade, variante_nome, observacao, complementos'\)/)
  assert.match(read('../src/app/api/equipe-app/cozinha/route.ts'), /novo === 'preparando' \? 'novo' : novo === 'pronto' \? 'preparando' : null/)
})

test('motoboy distribution modes and race-safe assignment', () => {
  const entregas = read('../src/lib/entregas.ts')
  assert.match(entregas, /'motoboys_escolhem' \| 'lojista_escolhe' \| 'automatico'/)
  assert.match(entregas, /\.is\('entregador_id', null\)\.eq\('status', 'pronto'\)/)
  const motoboy = read('../src/app/api/equipe-app/motoboy/route.ts')
  assert.match(motoboy, /\.eq\('status', 'pronto'\)\.is\('entregador_id', null\)/)
  assert.match(motoboy, /eq\('entregador_id', ctx\.userId\)/)
})

test('push dispatcher requires the shared secret', () => {
  const evento = read('../src/app/api/push/evento/route.ts')
  assert.match(evento, /timingSafeEqual/)
  assert.match(evento, /if \(!segredoConfere\(request\.headers\.get\('x-wd-segredo'\)\)\)/)
  assert.match(read('../public/sw-equipe.js'), /addEventListener\('push'/)
})
