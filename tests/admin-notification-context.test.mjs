import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'

const require = createRequire(import.meta.url)
const React = require('react')
const Server = require('react-dom/server')
const jsxRuntime = require('react/jsx-runtime')
const ts = require('typescript')

// Render the real admin pages and context. Replace only framework navigation,
// authentication and data dependencies; never access a real account or database.
const loaded = new Map()
const icon = () => React.createElement('span', { 'aria-hidden': true })
const icons = new Proxy({}, { get: (_, name) => name === '__esModule' ? true : icon })

function load(file) {
  if (loaded.has(file)) return loaded.get(file)
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const resolve = name => {
    if (name === 'react') return React
    if (name === 'react/jsx-runtime') return jsxRuntime
    if (name === 'lucide-react') return icons
    if (name === 'next/navigation') return {
      useRouter: () => ({ replace() {}, refresh() {} }),
      usePathname: () => '/painel-admin/lojistas',
      redirect() { throw new Error('Unexpected redirect') },
    }
    if (name === 'next/link') return {
      __esModule: true,
      default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children),
    }
    if (name === '@/lib/admin-auth') return { getAdminSession: async () => ({ email: 'test@example.com' }) }
    if (name === '@/components/toast') return load('src/components/toast.tsx')
    if (name === './admin-shell') return load('src/app/painel-admin/(main)/admin-shell.tsx')
    if (name === './admin.css') return {}
    if (name === '@/lib/cidades-brasil') return { ESTADOS: [] }
    if (name === '@/lib/utils') return { formatCurrency: value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
    if (name === '@/lib/admin-fetch') return { adminFetch() { throw new Error('Network access is prohibited in this test') } }
    if (name === '@/components/form-field') return {}
    throw new Error('Unexpected import: ' + name)
  }
  new Function('require', 'module', 'exports', outputText)(resolve, module, module.exports)
  loaded.set(file, module.exports)
  return module.exports
}

function render(element) {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough()
    let html = ''
    let firstError
    stream.on('data', chunk => { html += chunk })
    stream.on('end', () => resolve(html))
    stream.on('error', reject)
    const renderer = Server.renderToPipeableStream(element, {
      onError(error) { firstError = error },
      onShellError: reject,
      onAllReady() {
        if (firstError) { reject(firstError); return }
        renderer.pipe(stream)
      },
    })
  })
}

for (const route of ['lojistas', 'faturamento', 'relatorios']) {
  test('admin ' + route + ': layout supplies notification context', async () => {
    const Page = load('src/app/painel-admin/(main)/' + route + '/page.tsx').default
    const Shell = load('src/app/painel-admin/(main)/admin-shell.tsx').default
    const Layout = load('src/app/painel-admin/(main)/layout.tsx').default
    await assert.rejects(render(React.createElement(Shell, null, React.createElement(Page))), /ToastProvider/)
    const tree = await Layout({ children: React.createElement(Page) })
    const html = await render(tree)
    assert.ok(html.includes('wd-admin-mobile-nav'))
    assert.ok(html.includes('We Delivery'))
  })
}
