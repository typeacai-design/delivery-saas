const fs = require('fs')

const { query: sql } = require('./lib/supabase-management')


async function run() {
  const tenants = await sql(`
    SELECT t.id, t.nome, t.slug, t.status,
      (SELECT count(*) FROM categorias c WHERE c.tenant_id = t.id AND c.ativo) AS categorias_ativas,
      (SELECT count(*) FROM produtos p WHERE p.tenant_id = t.id AND p.ativo) AS produtos_ativos
    FROM tenants t
    WHERE t.slug IS NOT NULL
    ORDER BY t.created_at DESC;
  `)
  const policies = await sql(`
    SELECT schemaname, tablename, policyname, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('tenants', 'categorias', 'produtos', 'variantes', 'complementos', 'produto_complementos', 'enderecos_entrega')
    ORDER BY tablename, policyname;
  `)
  const products = await sql(`
    SELECT p.id, p.nome, p.ativo, p.categoria_id,
      c.nome AS categoria_nome, c.ativo AS categoria_ativa,
      p.disponivel_delivery
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.tenant_id = '1396a259-0217-4d26-b819-fd8a15d18dea';
  `)
  console.log(JSON.stringify({ tenants, products, policies }, null, 2))
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
