const { query: sql } = require('./lib/supabase-management')

async function run() {
  // 1. Verificar produtos com sabores_maximo inválido
  const invalidProducts = await sql(`
    SELECT id, nome, tenant_id, sabores_grupo_id, sabores_maximo
    FROM produtos
    WHERE sabores_maximo < 1 OR sabores_maximo > 10 OR sabores_maximo IS NULL
  `)
  console.log('Produtos com valores inválidos:', invalidProducts.length)
  if (invalidProducts.length > 0) {
    console.log(JSON.stringify(invalidProducts, null, 2))
  }

  // 2. Corrigir todos os produtos com valores inválidos para 1
  if (invalidProducts.length > 0) {
    const ids = invalidProducts.map(p => p.id)
    console.log(`\nCorrigindo ${ids.length} produtos...`)
    await sql(`
      UPDATE produtos SET sabores_maximo = 1
      WHERE id = ANY($1) AND (sabores_maximo < 1 OR sabores_maximo > 10 OR sabores_maximo IS NULL)
    `, [ids])
    console.log('Correção aplicada!')
  }

  // 3. Verificar distribuição de valores
  const distribution = await sql(`
    SELECT sabores_maximo, COUNT(*) as total
    FROM produtos
    WHERE sabores_maximo IS NOT NULL
    GROUP BY sabores_maximo
    ORDER BY sabores_maximo
  `)
  console.log('\nDistribuição de sabores_maximo:')
  console.log(JSON.stringify(distribution, null, 2))
}

run().catch(console.error)
