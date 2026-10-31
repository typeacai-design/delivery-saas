import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
const React = require('react')
const Server = require('react-dom/server')
const runtime = require('react/jsx-runtime')
const ts = require('typescript')
const passthrough = ({ children }) => children
const icon = () => React.createElement('span', { 'aria-hidden': true })
const icons = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : icon })
let pathname = '/dashboard'

function load(file, react = React, overrides = {}) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const resolve = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name]
    if (name === '@/lib/use-merchant-mobile') return { useMerchantMobile: () => true }
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return runtime
    if (name === 'lucide-react') return icons
    if (name.endsWith('.css')) return {}
    if (name === 'next/navigation') return { usePathname: () => pathname, useRouter: () => ({ replace() {}, refresh() {} }) }
    if (name === 'next/link') return { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children) }
    if (name === '@/lib/supabase/client') return { createClient: () => ({}) }
    if (name === '@/lib/active-tenant-client') return { activeTenantId: () => { throw new Error('Data access forbidden in layout test') } }
    if (name === '@/lib/utils') return { formatarCodigoPedido: (id, date, code) => code || id, formatCurrency: v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
    if (name === '@/components/toast') return { ToastProvider: passthrough, useToast: () => ({ error() {}, success() {} }) }
    if (name === '@/components/sidebar-nav') return { SidebarNav: () => null }
    if (name === '@/components/confirm-sair-modal') return { ConfirmSairModal: () => null }
    if (['@/components/error-boundary', '@/components/global-som-pedidos'].includes(name)) return { __esModule: true, default: passthrough }
    if (name.startsWith('@/')) { const path = 'src/' + name.slice(2); return load(path + (fs.existsSync(new URL('../' + path + '.tsx', import.meta.url)) ? '.tsx' : '.ts'), react, overrides) }
    throw new Error('Unexpected dependency: ' + name)
  }
  new Function('require', 'module', 'exports', outputText)(resolve, module, module.exports)
  return module.exports
}

function render(element) {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough()
    let html = '', firstError
    stream.on('data', chunk => { html += chunk })
    stream.on('end', () => resolve(html))
    stream.on('error', reject)
    const renderer = Server.renderToPipeableStream(element, {
      onError(error) { firstError = error },
      onShellError: reject,
      onAllReady() { if (firstError) reject(firstError); else renderer.pipe(stream) },
    })
  })
}

test('merchant shell retains authenticated navigation and mounts every child', async () => {
  const Shell = load('src/app/(dashboard)/dashboard-shell.tsx').default
  const html = await render(React.createElement(Shell, {
    tenantFromServer: { id: 'test-store', nome: 'Loja de teste', status: 'active' }, roleFromServer: 'owner',
  }, React.createElement('button', null, 'Existing action')))
  assert.match(html, /wd-merchant-nav/)
  for (const href of ['/dashboard', '/pedidos', '/cardapio', '/financeiro', '/mais']) assert.ok(html.includes('href="' + href + '"'))
  assert.match(html, /Existing action/)
})

test('order card displays all operational information before actions and forwards every action', async () => {
  const Card = load('src/components/merchant-order-card.tsx').default
  const invoked = []
  const callbacks = Object.fromEntries(['onAdvance','onEdit','onPaid','onWhatsApp','onPrint','onDiscount','onCancel','onDelete','onDetails','onReview'].map(name => [name, () => invoked.push(name)]))
  const props = { pedido: { id: 'test', codigo: '01234/26', data_criacao: '2026-10-30T20:38:00Z', status: 'novo', cliente_nome: 'Cliente teste', forma_pagamento: 'dinheiro', troco_para: 100, endereco_entrega: 'Rua de teste', numero_entrega: '12', bairro_entrega: 'Centro', complemento_entrega: 'Portão azul', observacoes: 'Sem colher', valor_total: 58, pago: false }, items: [{ id: 'one', nome: 'Casadinho', quantidade: 2, valor_unitario: 29, complementos: [{ nome: 'Granola', quantidade: 2, valor: 0 }] }], statusLabel: 'Novo', nextLabel: 'Preparando', ...callbacks }
  const html = await render(React.createElement(Card, props))
  const action = html.indexOf('Aceitar pedido')
  for (const label of ['Casadinho','Granola','FORMA DE PAGAMENTO','Rua de teste','Portão azul','Sem colher','Troco para']) { assert.ok(html.indexOf(label) >= 0, label); assert.ok(html.indexOf(label) < action, label + ' before actions') }
  const tree = Card(props)
  for (const button of elements(tree).filter(node => node.type === 'button')) button.props.onClick()
  assert.deepEqual(new Set(invoked), new Set(['onAdvance','onEdit','onPaid','onWhatsApp','onPrint','onDiscount','onCancel','onDetails']))
  const pickup = await render(React.createElement(Card, { ...props, pedido: { ...props.pedido, tipo_entrega: 'retirada', status: 'cancelado' }, nextLabel: undefined, statusLabel: 'Cancelado' }))
  assert.match(pickup, /Retirada no balcão/); assert.match(pickup, /Apagar/); assert.doesNotMatch(pickup, /ENDEREÇO DE ENTREGA/)
})

test('alarm ignores initial/old/duplicate orders and waits for every new arrival to be resolved', () => {
  const { OrderAlertTracker } = load('src/lib/order-alert-tracker.ts')
  const tracker = new OrderAlertTracker(new Date('2026-10-30T20:00:00Z').getTime())
  tracker.snapshot([{ id: 'old', status: 'novo' }]); assert.equal(tracker.pending.size, 0)
  tracker.receive({ id: 'old', status: 'novo' }); assert.equal(tracker.pending.size, 0)
  tracker.snapshot([{ id: 'historical', status: 'novo', data_criacao: '2026-10-29T20:00:00Z' }]); assert.equal(tracker.pending.size, 0)
  tracker.receive({ id: 'unknown-update', status: 'novo' }, false); assert.equal(tracker.pending.size, 0)
  tracker.receive({ id: 'new-a', status: 'novo' }); tracker.receive({ id: 'new-a', status: 'novo' }); tracker.receive({ id: 'new-b', status: 'novo' })
  assert.equal(tracker.pending.size, 2)
  tracker.receive({ id: 'old', status: 'preparando' }, false); assert.equal(tracker.pending.size, 2)
  tracker.receive({ id: 'new-a', status: 'preparando' }, false); assert.deepEqual([...tracker.pending], ['new-b'])
  tracker.snapshot([]); assert.deepEqual([...tracker.pending], ['new-b'], 'paginated fetch cannot silence a pending order')
  tracker.receive({ id: 'new-b', status: 'cancelado' }, false); assert.equal(tracker.pending.size, 0)
  tracker.snapshot([{ id: 'missed-realtime', status: 'novo' }]); assert.equal(tracker.pending.size, 1, 'polling recovers a missed INSERT')
  tracker.receive({ id: 'missed-realtime', status: 'novo', deleted_at: 'now' }, false); assert.equal(tracker.pending.size, 0)
  const reload = new OrderAlertTracker(); reload.snapshot([{ id: 'old', status: 'novo' }]); assert.equal(reload.pending.size, 0, 'reload is silent')
})

test('Hoje/Ontem use exact calendar days, including month and year boundaries', () => {
  const { orderPeriodRange } = load('src/lib/order-period.ts')
  assert.deepEqual(orderPeriodRange('hoje', new Date(2026, 9, 30, 23, 59)), { from: '2026-10-30', to: '2026-10-30' })
  assert.deepEqual(orderPeriodRange('ontem', new Date(2026, 9, 30, 0, 1)), { from: '2026-10-29', to: '2026-10-29' })
  assert.deepEqual(orderPeriodRange('ontem', new Date(2027, 0, 1)), { from: '2026-12-31', to: '2026-12-31' })
  assert.deepEqual(orderPeriodRange('ontem', new Date(2026, 2, 1)), { from: '2026-02-28', to: '2026-02-28' })
})

test('global audio stays silent on load/first touch, loops for arrivals, and stops only after the last resolution', async t => {
  const original = Object.fromEntries(['window','document','fetch'].map(key => [key, globalThis[key]]))
  t.after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value } })
  const events = {}, listeners = {}, states = [], sources = []
  let effect, removed = false
  const channel = { on(kind, filter, callback) { events[filter.event] = callback; return this }, subscribe(callback) { callback('SUBSCRIBED'); return this } }
  class AudioContextMock {
    state = 'suspended'; destination = {}
    resume() { this.state = 'running'; return Promise.resolve() }
    decodeAudioData() { return Promise.resolve({ decoded: true }) }
    createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} } }
    createBufferSource() { const source = { loop: false, starts: 0, stops: 0, connect() {}, disconnect() {}, start() { this.starts++ }, stop() { this.stops++; this.onended?.() } }; sources.push(source); return source }
    close() { return Promise.resolve() }
  }
  globalThis.window = { AudioContext: AudioContextMock, addEventListener(name, cb) { listeners[name] = cb }, removeEventListener(name) { delete listeners[name] }, setInterval() { return 1 } }
  globalThis.document = { visibilityState: 'visible', addEventListener(name, cb) { listeners[name] = cb }, removeEventListener(name) { delete listeners[name] } }
  globalThis.fetch = async url => url.includes('/sounds/') ? { ok: true, arrayBuffer: async () => new ArrayBuffer(1) } : { ok: true, json: async () => ({ ok: true, tenantId: 'store', pedidos: [{ id: 'old', status: 'novo', data_criacao: '2026-01-01T00:00:00Z' }] }) }
  const react = { ...React, useRef: initial => ({ current: initial }), useEffect(cb) { effect = cb }, useState: () => [0, n => states.push(n)] }
  const Global = load('src/components/global-som-pedidos.tsx', react, {
    '@/lib/active-tenant-client': { activeTenantId: async () => 'store' },
    '@/lib/supabase/client': { createClient: () => ({ channel: () => channel, removeChannel() { removed = true } }) },
  }).default
  Global({ children: null }); const cleanup = effect()
  const flush = () => new Promise(resolve => setImmediate(resolve))
  await flush(); assert.equal(sources.length, 0)
  listeners.pointerdown(); await flush(); assert.equal(sources.length, 0, 'unlock never plays the alert')
  events.INSERT({ new: { id: 'a', status: 'novo', data_criacao: new Date(Date.now() + 1000).toISOString() } }); await flush()
  assert.equal(sources.length, 1); assert.equal(sources[0].starts, 1); assert.equal(sources[0].loop, true)
  events.INSERT({ new: { id: 'b', status: 'novo' } }); events.UPDATE({ new: { id: 'old', status: 'preparando' } }); assert.equal(sources[0].stops, 0)
  events.UPDATE({ new: { id: 'a', status: 'preparando' } }); assert.equal(states.at(-1), 1); assert.equal(sources[0].stops, 0)
  events.UPDATE({ new: { id: 'b', status: 'cancelado' } }); assert.equal(states.at(-1), 0); assert.equal(sources[0].stops, 1)
  events.INSERT({ new: { id: 'c', status: 'novo' } }); assert.equal(sources.length, 2)
  cleanup(); assert.equal(sources[1].stops, 1); assert.equal(removed, true); assert.equal(Object.keys(listeners).length, 0)
})

test('all secondary tools remain reachable through More', async () => {
  const Page = load('src/app/(dashboard)/mais/page.tsx').default
  const html = await render(React.createElement(Page))
  for (const href of ['/gestao', '/equipe', '/marketing', '/relatorios', '/configuracoes', '/clientes', '/mesas', '/suporte']) assert.ok(html.includes('href="' + href + '"'))
})

test('product editor keeps every field group mounted inside mobile disclosures', async () => {
  const Form = load('src/components/admin/ProdutoFormModal.tsx').default
  const html = await render(React.createElement(Form, { categorias: [{ id: 'food', nome: 'Pratos' }], onClose() {}, onSaved() {} }))
  for (const label of ['Dados básicos', 'Foto do item', 'Fidelidade e limites de venda', 'Visibilidade e etiquetas', 'Controle de estoque', 'Divisão em sabores', 'Complementos vinculados', 'Ingredientes / Matéria-prima', 'Salvar produto', 'Cancelar']) assert.ok(html.includes(label), label)
  assert.equal((html.match(/<details/g) || []).length, 8)
  assert.ok(html.includes('type="file"'))
})

test('desktop product editor is the original component and mobile editor is preserved verbatim', async () => {
  const gitBlob = path => { const data = fs.readFileSync(new URL('../' + path, import.meta.url)); return createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') }
  assert.equal(gitBlob('src/components/admin/ProdutoFormModalDesktop.tsx'), '48072681c3b380f6df5372a53a1c6e272d24dcb3', 'desktop matches pre-redesign GitHub source')
  assert.equal(gitBlob('src/components/admin/ProdutoFormModalMobile.tsx'), '2528dd101e558956ce9be593af28727286b4efcf', 'approved mobile source is unchanged')
  const Form = load('src/components/admin/ProdutoFormModal.tsx', React, { '@/lib/use-merchant-mobile': { useMerchantMobile: () => false } }).default
  const html = await render(React.createElement(Form, { categorias: [{ id: 'food', nome: 'Pratos' }], onClose() {}, onSaved() {} }))
  for (const label of ['Pontos de fidelidade','Limites de venda','Visibilidade no cardápio','Buscar complemento...','Criar item']) assert.ok(html.includes(label), label)
  assert.doesNotMatch(html, /wd-product-editor/)
  assert.doesNotMatch(html, /<details/)
})

test('desktop disclosures render original children without adding layout wrappers', async () => {
  const Disclosure = load('src/components/merchant-disclosure.tsx', React, { '@/lib/use-merchant-mobile': { useMerchantMobile: () => false } }).default
  const child = React.createElement('section', { className: 'original-grid' }, React.createElement('input', { defaultValue: '25' }))
  assert.equal(await render(React.createElement(Disclosure, { title: 'Produtos' }, child)), await render(child))
})

test('compact range picker applies only complete ranges, supports reverse/cross-month selection, and cancels without applying', () => {
  let values = [], cursor = 0, applied = { from: '2026-10-30', to: '2026-10-30' }, calls = 0
  const react = { ...React, useId: () => 'period-test', useRef: () => ({ current: { focus() {} } }), useState(initial) { const index = cursor++; if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial; return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value }] } }
  const Picker = load('src/components/merchant-date-range.tsx', react).default
  const tree = () => { cursor = 0; return Picker({ ...applied, onApply(range) { applied = range; calls++ } }) }
  const button = predicate => elements(tree()).find(node => node.type === 'button' && predicate(node.props))
  const textButton = text => button(props => props.children === text)
  button(props => props['aria-expanded'] !== undefined).props.onClick()
  assert.equal(textButton('Aplicar período').props.disabled, true)
  button(props => props['aria-label'] === '29 de outubro de 2026').props.onClick()
  assert.equal(textButton('Aplicar período').props.disabled, true)
  button(props => props['aria-label'] === '28 de outubro de 2026').props.onClick()
  assert.equal(textButton('Aplicar período').props.disabled, false)
  textButton('Aplicar período').props.onClick()
  assert.deepEqual(applied, { from: '2026-10-28', to: '2026-10-29' }); assert.equal(calls, 1)
  button(props => props['aria-expanded'] !== undefined).props.onClick()
  button(props => props['aria-label'] === 'Mês anterior').props.onClick()
  button(props => props['aria-label'] === '30 de setembro de 2026').props.onClick()
  button(props => props['aria-label'] === 'Próximo mês').props.onClick()
  button(props => props['aria-label'] === '1 de outubro de 2026').props.onClick()
  textButton('Aplicar período').props.onClick()
  assert.deepEqual(applied, { from: '2026-09-30', to: '2026-10-01' })
  button(props => props['aria-expanded'] !== undefined).props.onClick()
  button(props => props['aria-label'] === '4 de setembro de 2026').props.onClick()
  textButton('Cancelar').props.onClick()
  assert.equal(calls, 2); assert.deepEqual(applied, { from: '2026-09-30', to: '2026-10-01' })
  assert.equal(button(props => props['aria-expanded'] !== undefined).props['aria-expanded'], false)
})

test('compact range formatting and one-day selection preserve dates across year boundaries', () => {
  const { chooseOrderRange, formatOrderDateRange } = load('src/components/merchant-date-range.tsx')
  assert.deepEqual(chooseOrderRange({ from: '2026-10-30', to: '' }, '2026-10-30'), { from: '2026-10-30', to: '2026-10-30' })
  assert.deepEqual(chooseOrderRange({ from: '2026-12-31', to: '' }, '2027-01-02'), { from: '2026-12-31', to: '2027-01-02' })
  const label = formatOrderDateRange({ from: '2026-12-31', to: '2027-01-02' }); assert.match(label, /2026/); assert.match(label, /2027/)
  assert.equal(formatOrderDateRange({ from: '', to: '' }), 'Selecionar período')
})

test('desktop order form body matches the original layout and mobile-only controls stay hidden', () => {
  const page = fs.readFileSync(new URL('../src/app/(dashboard)/pedidos/page.tsx', import.meta.url), 'utf8')
  const modal = page.indexOf('      {/* MODAL DE EDIÇÃO */}')
  const start = page.indexOf('            ) : (', modal) + '            ) : ('.length
  const end = page.indexOf('            )}', start)
  const digest = createHash('sha256').update(page.slice(start, end).trim()).digest('hex')
  assert.equal(digest, '1f1e1ecd970e37bb8626f310f6564c09638029b756a7fe910f1f4c9bc76d2ad6')
  assert.match(page, /wd-desktop-orders-controls/); assert.match(page, /Mostrando/); assert.match(page, /Limpar filtro/)
  const css = fs.readFileSync(new URL('../src/app/(dashboard)/merchant.css', import.meta.url), 'utf8')
  assert.match(css, /wd-desktop-orders-controls[^}]+display:none!important/)
})

test('product row retains edit, duplicate, active switch and delete controls', async () => {
  const Row = load('src/components/admin/ProdutoLinha.tsx').default
  const html = await render(React.createElement(Row, {
    produto: { id: 'test', nome: 'Produto de teste', ativo: true, preco: 25, pontos: 10 }, complementosCount: 2,
    onEdit() {}, onToggleAtivo() {}, onDuplicate() {}, onUpdate() {}, onDelete() {}, onExcluir() {},
  }))
  for (const label of ['Editar', 'Duplicar', 'Desativar produto', 'Excluir permanentemente']) assert.ok(html.includes('aria-label="' + label + '"'))
  assert.match(html, /Produto de teste/)
  const card = html.slice(html.indexOf('<article'), html.indexOf('</article>')); assert.equal((card.match(/R\$/g) || []).length, 1, 'card price displays currency once'); assert.match(card, /wd-fp-stats/); assert.match(card, /Subir produto/); assert.match(card, /Descer produto/)
  assert.match(html, /wd-fp-photo/, 'card photo or placeholder remains present')
})

function elements(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(elements)
  return [node, ...elements(node.props?.children)]
}

test('mobile stage selector changes filters and closes without changing an order', () => {
  let expanded = false
  let selected = 'novo'
  const react = { ...React, useState: () => [expanded, value => { expanded = value }] }
  const Stages = load('src/components/merchant-order-stages.tsx', react).default
  const stages = [{ id: 'novo', label: 'Novo', count: 2 }, { id: 'preparando', label: 'Preparando', count: 3 }]
  const tree = () => Stages({ stages, selected, onSelect: value => { selected = value } })
  elements(tree()).find(n => n.props?.['aria-label'] === 'Próxima etapa').props.onClick()
  assert.equal(selected, 'preparando')
  elements(tree()).find(n => n.props?.['aria-expanded'] !== undefined).props.onClick()
  assert.equal(expanded, true)
  elements(tree()).find(n => n.props?.['aria-pressed'] === false).props.onClick()
  assert.equal(selected, 'novo')
  assert.equal(expanded, false)
  assert.deepEqual(stages.map(stage => stage.count), [2, 3])
})

test('disclosure toggle preserves its existing form subtree', () => {
  let open = false
  const react = { ...React, useState: () => [open, value => { open = value }], useRef: () => ({ current: null }), useEffect() {} }
  const Disclosure = load('src/components/merchant-disclosure.tsx', react).default
  const child = React.createElement('input', { name: 'existing-price', defaultValue: '25' })
  const tree = () => Disclosure({ title: 'Pizzas', children: child })
  assert.equal(tree().props.open, false)
  tree().props.onToggle({ currentTarget: { open: true } })
  assert.equal(tree().props.open, true)
  tree().props.onToggle({ currentTarget: { open: false } })
  assert.equal(tree().props.open, false)
  assert.ok(elements(tree()).includes(child))
})


test('list selection adds/removes a whole list and preserves unrelated existing links', () => {
  const { toggleComplementList, complementListState } = load('src/lib/product-complement-selection.ts')
  const complements = [{ id: 'banana', categoria_id: 'fruit' }, { id: 'apple', categoria_id: 'fruit' }, { id: 'juice', categoria_id: 'drinks' }]
  const legacy = ['banana', 'juice', 'inactive-legacy']
  assert.equal(complementListState(legacy, complements, 'fruit').partial, true)
  const selected = toggleComplementList(legacy, complements, 'fruit')
  assert.deepEqual(new Set(selected), new Set(['banana', 'apple', 'juice', 'inactive-legacy']))
  assert.deepEqual(new Set(toggleComplementList(selected, complements, 'fruit')), new Set(['juice', 'inactive-legacy']))
  assert.deepEqual(toggleComplementList(legacy, complements, 'empty'), legacy)
  assert.deepEqual(legacy, ['banana', 'juice', 'inactive-legacy'])
})
