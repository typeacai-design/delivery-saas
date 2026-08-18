const fs = require('node:fs')
const { query } = require('./lib/supabase-management')

async function main() {
  await query(fs.readFileSync('supabase/migrations/042_sessoes_categorias_produtos.sql', 'utf8'))
  const result = await query(`select to_regclass('public.categorias_produtos') is not null as tabela,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='produtos' and column_name='categoria_produto_id') as coluna`)
  console.log(JSON.stringify(result))
}
main().catch((error) => { console.error(error.message); process.exit(1) })
