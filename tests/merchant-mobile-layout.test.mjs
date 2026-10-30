import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'

const require = createRequire(import.meta.url)
const React = require('react')
const Server = require('react-dom/server')
const runtime = require('react/jsx-runtime')
const ts = require('typescript')
const passthrough = ({ children }) => children
const icon = () => React.createElement('span', { 'aria-hidden': true })
const icons = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : icon })
let pathname = '/dashboard'

function load(file, react = React) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const resolve = name => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return runtime
    if (name === 'lucide-react') return icons
    if (name.endsWith('.css')) return {}
    if (name === 'next/navigation') return { usePathname: () => pathname, useRouter: () => ({ replace() {}, refresh() {} }) }
    if (name === 'next/link') return { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children) }
    if (name === '@/lib/supabase/client') return { createClient: () => ({}) }
    if (name === '@/lib/active-tenant-client') return { activeTenantId: () => { throw new Error('Data access forbidden in layout test') } }
    if (name === '@/lib/utils') return { formatCurrency: v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
    if (name === '@/components/toast') return { ToastProvider: passthrough, useToast: () => ({ error() {}, success() {} }) }
    if (name === '@/components/sidebar-nav') return { SidebarNav: () => null }
    if (name === '@/components/confirm-sair-modal') return { ConfirmSairModal: () => null }
    if (['@/components/error-boundary', '@/components/global-som-pedidos'].includes(name)) return { __esModule: true, default: passthrough }
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.tsx', react)
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

test('all secondary tools remain reachable through More', async () => {
  const Page = load('src/app/(dashboard)/mais/page.tsx').default
  const html = await render(React.createElement(Page))
  for (const href of ['/gestao', '/equipe', '/marketing', '/relatorios', '/configuracoes', '/clientes', '/mesas', '/suporte']) assert.ok(html.includes('href="' + href + '"'))
})

test('product editor keeps every field group mounted inside mobile disclosures', async () => {
  const Form = load('src/components/admin/ProdutoFormModal.tsx').default
  const html = await render(React.createElement(Form, { categorias: [{ id: 'food', nome: 'Pratos' }], onClose() {}, onSaved() {} }))
  for (const label of ['Dados básicos', 'Foto do item', 'Pontos de fidelidade', 'Visibilidade no cardápio', 'Limites de venda', 'Controle de estoque', 'Divisão em sabores', 'Complementos vinculados', 'Ingredientes / Matéria-prima', 'Salvar item', 'Cancelar']) assert.ok(html.includes(label), label)
  assert.equal((html.match(/<details/g) || []).length, 9)
  assert.ok(html.includes('type="file"'))
})

test('product row retains edit, duplicate, active switch and delete controls', async () => {
  const Row = load('src/components/admin/ProdutoLinha.tsx').default
  const html = await render(React.createElement(Row, {
    produto: { id: 'test', nome: 'Produto de teste', ativo: true, preco: 25, pontos: 10 }, complementosCount: 2,
    onEdit() {}, onToggleAtivo() {}, onDuplicate() {}, onUpdate() {}, onDelete() {}, onExcluir() {},
  }))
  for (const label of ['Editar', 'Duplicar', 'Desativar produto', 'Excluir permanentemente']) assert.ok(html.includes('aria-label="' + label + '"'))
  assert.match(html, /Produto de teste/)
  assert.equal((html.match(/R\$/g) || []).length, 1, 'price must display the currency symbol once')
  assert.match(html, /wd-product-photo/, 'photo and placeholder share the same layout slot')
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
