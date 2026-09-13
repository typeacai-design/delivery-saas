import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as flavor from '../src/lib/flavor-pricing.ts'
import * as pricing from '../src/lib/product-pricing.ts'
export function compile(file, imports = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, require: name => { if (!(name in imports)) throw new Error('Unexpected import ' + name); return imports[name] }, process: { env: {} }, console, Headers, Response, URL }
  vm.runInNewContext(compiled, context)
  return context.exports
}
export const server = compile('src/lib/flavor-order-server.ts', { './flavor-pricing': flavor, './product-pricing': pricing })
export function database(overrides = {}) {
  const rows = {
    tenants: [{ id: 'shop', sabores_ativo: true, status: 'active', config: { loja_aberta: true } }],
    produtos: [{ id: 'pizza', tenant_id: 'shop', nome: 'Pizza', ativo: true, preco: 99, sabores_grupo_id: 'flavors', sabores_maximo: 3 }],
    categorias_complementos: [{ id: 'flavors', tenant_id: 'shop', ativo: true, qtd_minima: 1, qtd_maxima: 1 }, { id: 'extras', tenant_id: 'shop', ativo: true, qtd_minima: 0, qtd_maxima: 3 }],
    complementos: [
      { id: 'a', tenant_id: 'shop', nome: 'Calabresa', preco: 30, ativo: true, categoria_id: 'flavors' },
      { id: 'b', tenant_id: 'shop', nome: 'Frango', preco: 36, ativo: true, categoria_id: 'flavors' },
      { id: 'c', tenant_id: 'shop', nome: 'Portuguesa', preco: 39, ativo: true, categoria_id: 'flavors' },
      { id: 'edge', tenant_id: 'shop', nome: 'Borda', preco: 8, ativo: true, categoria_id: 'extras' },
    ],
    produto_complementos: ['a','b','c','edge'].map(complemento_id => ({ produto_id: 'pizza', complemento_id })),
    variantes: [], clientes: [], pedidos: [],
    ...overrides,
  }
  const writes = []
  return { rows, writes,
    from(table) {
      if (!(table in rows)) throw new Error('Unexpected table ' + table)
      let filtered = rows[table], singular = false
      const chain = {
        select(columns = '*') {
          if (table === 'categorias_complementos' && columns !== '*') {
            const actual = new Set(['id','tenant_id','nome','ordem','ativo','created_at','qtd_minima','qtd_maxima','descricao','max_um_de_cada','imagem_url'])
            for (const column of columns.split(',')) if (!actual.has(column.trim())) throw new Error('Unknown production group column: ' + column)
          }
          return chain
        }, eq(key, value) { filtered = filtered.filter(row => row[key] === value); return chain },
        in(key, values) { filtered = filtered.filter(row => values.includes(row[key])); return chain },
        limit(n) { filtered = filtered.slice(0,n); return chain }, single() { singular=true; return chain }, maybeSingle() { singular=true; return chain },
        then(resolve,reject) { return Promise.resolve({ data: singular ? filtered[0] || null : filtered, error: null, count: filtered.length }).then(resolve,reject) },
      }
      return chain
    },
    async rpc(name,args) { writes.push({ name,args }); return { data: { id: 'order',codigo: '1',status: 'novo',...args.p_pedido }, error: null } },
  }
}
export function item(count = 2, ids = ['a','b']) { return { produto_id: 'pizza', quantidade: 1, sabores_quantidade: count, valor_unitario: 999, complementos: ids.map(id => ({ id, quantidade: 1, valor: 999 })) } }
