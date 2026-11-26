import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('table QR orders are tied to the table and its open tab', () => {
  const route = read('../src/app/api/pedidos/public/route.ts')
  assert.match(route, /\/\^\[a-f0-9\]\{32\}\$\/\.test\(mesa_token\)/)
  assert.match(route, /eq\('qr_token', mesa_token\)\.eq\('ativa', true\)/)
  assert.match(route, /tipo_pedido: 'mesa', mesa_id: mesaPedido\.id, sessao_mesa_id/)
  assert.match(route, /const cashbackSolicitado=modoMesa\?0:/)
  assert.match(route, /const tipo_entrega = modoMesa \? 'mesa' : tipoEntregaInformado === 'retirada' \? 'retirada' : 'delivery'/)
})

test('checkout at the table asks only the name and skips delivery', () => {
  const checkout = read('../src/components/checkout-flow.tsx')
  assert.match(checkout, /WhatsApp \(opcional\)/)
  assert.match(checkout, /\['cliente', 'pagamento', 'aniversario', 'observacoes'\]/)
  assert.match(checkout, /mesa_token: mesa\?\.token \|\| null/)
  const page = read('../src/app/cardapio/[slug]/page.tsx')
  assert.match(page, /eq\('qr_token', mesaParam\)/)
})

test('auto-accept and table QR migration', () => {
  const sql = read('../supabase/migrations/20261124190000_mesas_qr_e_aceite_automatico.sql')
  assert.match(sql, /NEW\.status := 'preparando'/)
  assert.match(sql, /sessoes_mesa_uma_aberta_por_mesa ON public\.sessoes_mesa \(tenant_id, mesa_numero\) WHERE status = 'aberta'/)
  assert.match(sql, /mesas_qr_token_key/)
  assert.match(sql, /ELSIF NULLIF\(btrim\(coalesce\(p_cliente->>'telefone',''\)\),''\) IS NOT NULL THEN/)
})

test('desktop flow is a kanban where dropping equals the advance button', () => {
  const kanban = read('../src/components/merchant-order-kanban.tsx')
  assert.match(kanban, /const accepts = target === column\.id/)
  assert.match(kanban, /if \(dragging && accepts\) onMove\(dragging, column\.id\)/)
  const page = read('../src/app/(dashboard)/pedidos/page.tsx')
  assert.match(page, /const kanbanFluxo = !mobile && pedidosTab === 'fluxo'/)
  assert.match(page, /onMove=\{\(pedido, status\) => updateStatus\(pedido, status as PedidoStatus\)\}/)
  assert.match(page, /Aceitar automático/)
})

test('tables with an open tab cannot be deleted or renumbered', () => {
  const settings = read('../src/app/(dashboard)/configuracoes/page.tsx')
  assert.match(settings, /tem comanda aberta\. Feche a conta antes de excluir/)
  assert.match(settings, /Feche a comanda aberta desta mesa antes de mudar o número/)
})
