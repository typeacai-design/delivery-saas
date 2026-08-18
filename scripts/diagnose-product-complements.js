const fs = require('fs')

const { query: sql } = require('./lib/supabase-management')


async function run() {
  const rows = await sql(`
    SELECT t.id AS tenant_id, t.nome AS tenant, p.id AS produto_id, p.nome AS produto,
      pc.complemento_id, c.nome AS complemento, c.categoria_id,
      cc.nome AS lista, cc.ordem AS lista_ordem
    FROM produtos p
    LEFT JOIN produto_complementos pc ON pc.produto_id = p.id
    LEFT JOIN complementos c ON c.id = pc.complemento_id
    LEFT JOIN categorias_complementos cc ON cc.id = c.categoria_id
    JOIN tenants t ON t.id = p.tenant_id
    WHERE t.slug = 'typeacai' AND p.nome ILIKE '%Copo de 300ml%'
    ORDER BY cc.ordem, c.ordem, c.nome;
  `)
  const inventory = await sql(`
    SELECT t.id AS tenant_id, t.nome AS tenant,
      (SELECT count(*) FROM complementos c WHERE c.tenant_id=t.id AND c.ativo) AS complementos,
      (SELECT count(*) FROM categorias_complementos cc WHERE cc.tenant_id=t.id AND cc.ativo) AS listas,
      (SELECT count(*) FROM produto_complementos pc JOIN produtos p2 ON p2.id=pc.produto_id WHERE p2.tenant_id=t.id) AS vinculos
    FROM tenants t WHERE t.slug='typeacai';
  `)
  const catalog = await sql(`
    SELECT p.id, p.nome, p.descricao, p.ativo,
      (SELECT count(*) FROM produto_complementos pc WHERE pc.produto_id=p.id) AS vinculos
    FROM produtos p JOIN tenants t ON t.id=p.tenant_id
    WHERE t.slug='typeacai' ORDER BY p.nome, p.created_at;
  `)
  const complements = await sql(`
    SELECT c.id, c.nome, c.preco, c.ativo, c.categoria_id, c.ordem
    FROM complementos c JOIN tenants t ON t.id=c.tenant_id
    WHERE t.slug='typeacai' ORDER BY c.nome;
  `)
  const lists = await sql(`
    SELECT cc.id, cc.nome, cc.ativo, cc.ordem, cc.qtd_minima, cc.qtd_maxima
    FROM categorias_complementos cc JOIN tenants t ON t.id=cc.tenant_id
    WHERE t.slug='typeacai' ORDER BY cc.ordem, cc.nome;
  `)
  const columns = await sql(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('categorias_complementos','complementos','produto_complementos')
    ORDER BY table_name, ordinal_position;
  `)
  console.log(JSON.stringify({ rows, inventory, catalog, complements, lists, columns }, null, 2))
}

run().catch((error) => { console.error(error.message); process.exit(1) })
