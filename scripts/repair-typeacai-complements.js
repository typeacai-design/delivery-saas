const fs = require('fs')

const { query: sql } = require('./lib/supabase-management')


async function run() {
  const result = await sql(`
    DO $$
    DECLARE
      v_tenant uuid;
      v_produto uuid;
      v_frutas uuid;
      v_adicionais uuid;
      v_comp uuid;
      v_nome text;
      v_ordem integer;
    BEGIN
      SELECT id INTO STRICT v_tenant FROM tenants WHERE slug = 'typeacai';
      UPDATE categorias SET nome='Monte do seu jeito' WHERE tenant_id=v_tenant AND ativo=true AND lower(nome) LIKE 'monte%jeito%';
      SELECT id INTO STRICT v_produto FROM produtos
        WHERE tenant_id = v_tenant AND nome = 'Copo de 300ml' AND ativo = true
        ORDER BY created_at DESC LIMIT 1;

      SELECT id INTO v_frutas FROM categorias_complementos
        WHERE tenant_id=v_tenant AND id='3337e1bf-7997-4479-ae8a-2100b073e935';
      IF v_frutas IS NULL THEN
        INSERT INTO categorias_complementos (tenant_id,nome,ordem,ativo,qtd_minima,qtd_maxima,max_um_de_cada)
        VALUES (v_tenant,'Frutas',1,true,0,2,true) RETURNING id INTO v_frutas;
      ELSE
        UPDATE categorias_complementos SET nome='Frutas',ordem=1,ativo=true,qtd_minima=0,qtd_maxima=2,max_um_de_cada=true
        WHERE id=v_frutas;
      END IF;

      SELECT id INTO v_adicionais FROM categorias_complementos
        WHERE tenant_id=v_tenant AND lower(nome)=lower('Adicionais') LIMIT 1;
      IF v_adicionais IS NULL THEN
        INSERT INTO categorias_complementos (tenant_id,nome,ordem,ativo,qtd_minima,qtd_maxima,max_um_de_cada)
        VALUES (v_tenant,'Adicionais',2,true,0,3,true) RETURNING id INTO v_adicionais;
      ELSE
        UPDATE categorias_complementos SET ordem=2,ativo=true,qtd_minima=0,qtd_maxima=3,max_um_de_cada=true
        WHERE id=v_adicionais;
      END IF;

      FOR v_nome, v_ordem IN SELECT * FROM (VALUES ('Banana',1),('Maçã',2)) x(nome,ordem) LOOP
        SELECT id INTO v_comp FROM complementos WHERE tenant_id=v_tenant AND lower(nome)=lower(v_nome) LIMIT 1;
        IF v_comp IS NULL THEN
          INSERT INTO complementos (tenant_id,nome,preco,ativo,categoria_id,ordem,qtd_max)
          VALUES (v_tenant,v_nome,0,true,v_frutas,v_ordem,1) RETURNING id INTO v_comp;
        ELSE
          UPDATE complementos SET ativo=true,categoria_id=v_frutas,ordem=v_ordem,qtd_max=1 WHERE id=v_comp;
        END IF;
        INSERT INTO produto_complementos (produto_id,complemento_id) VALUES (v_produto,v_comp)
        ON CONFLICT DO NOTHING;
      END LOOP;

      FOR v_nome, v_ordem IN SELECT * FROM (VALUES ('Leite em Pó',1),('Leite Condensado',2),('Sucrilhos',3)) x(nome,ordem) LOOP
        SELECT id INTO v_comp FROM complementos WHERE tenant_id=v_tenant AND lower(nome)=lower(v_nome) LIMIT 1;
        IF v_comp IS NULL THEN
          INSERT INTO complementos (tenant_id,nome,preco,ativo,categoria_id,ordem,qtd_max)
          VALUES (v_tenant,v_nome,0,true,v_adicionais,v_ordem,1) RETURNING id INTO v_comp;
        ELSE
          UPDATE complementos SET ativo=true,categoria_id=v_adicionais,ordem=v_ordem,qtd_max=1 WHERE id=v_comp;
        END IF;
        INSERT INTO produto_complementos (produto_id,complemento_id) VALUES (v_produto,v_comp)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END $$;

    SELECT cc.nome AS lista, cc.ordem, cc.qtd_minima, cc.qtd_maxima,
      json_agg(c.nome ORDER BY c.ordem) AS itens
    FROM categorias_complementos cc
    JOIN complementos c ON c.categoria_id=cc.id AND c.ativo
    JOIN produto_complementos pc ON pc.complemento_id=c.id
    JOIN produtos p ON p.id=pc.produto_id
    JOIN tenants t ON t.id=p.tenant_id
    WHERE t.slug='typeacai' AND p.nome='Copo de 300ml' AND p.ativo
    GROUP BY cc.id, cc.nome, cc.ordem, cc.qtd_minima, cc.qtd_maxima
    ORDER BY cc.ordem;
  `)
  console.log(JSON.stringify(result, null, 2))
}

run().catch((error) => { console.error(error.message); process.exit(1) })
