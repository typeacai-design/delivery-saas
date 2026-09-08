-- Migration 082: Bebidas + Batata consolidada + Pastel (Cozinha da Cris)

BEGIN;

DO $$
DECLARE
  v_tenant_id uuid := '475158ca-9e84-4d30-8167-5975306907dc';
  v_cat_id uuid;
  v_prod_id uuid;
  v_comp record;
BEGIN

  -- ============================================
  -- 1) ATUALIZAR LISTA DE BEBIDAS (renomear)
  -- ============================================
  -- Atualizar nome visível para "Bebidas"
  UPDATE categorias_complementos
  SET nome = 'Bebidas',
      qtd_minima = 0,
      qtd_maxima = 5,
      max_um_de_cada = false,
      ativo = true
  WHERE tenant_id = v_tenant_id
  AND descricao = 'BEBIDAS GERAL';

  -- Pegar ID da lista de Bebidas
  SELECT id INTO v_cat_id FROM categorias_complementos
  WHERE tenant_id = v_tenant_id AND descricao = 'BEBIDAS GERAL';

  -- Cadastrar as 16 bebidas (sem separar por tipo)
  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Coca-Cola 2 L', 16.00),
      ('Coca-Cola 1 L', 11.00),
      ('Refrigerante em lata', 6.00),
      ('Água', 4.00),
      ('Água com gás', 5.00),
      ('H2O', 8.00),
      ('Heineken', 14.00),
      ('Stella', 12.00),
      ('Budweiser', 10.00),
      ('Suco de laranja 500 ml', 12.00),
      ('Suco de abacaxi com hortelã 500 ml', 12.00),
      ('Suco de maracujá 500 ml', 12.00),
      ('Suco de bacuri 500 ml', 12.00),
      ('Suco de goiaba 500 ml', 12.00),
      ('Suco de acerola 500 ml', 12.00),
      ('Suco de caju 500 ml', 12.00)
    ) AS t(nome, preco)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );
  END LOOP;

  -- ============================================
  -- 2) VINCULAR BEBIDAS A TODOS OS PRODUTOS
  -- ============================================
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT p.id, c.id
  FROM produtos p, complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE p.tenant_id = v_tenant_id
  AND c.tenant_id = v_tenant_id
  AND cat.descricao = 'BEBIDAS GERAL'
  AND p.ativo = true
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 3) CRIAR LISTA "TAMANHO BATATA"
  -- ============================================
  INSERT INTO categorias_complementos (tenant_id, nome, descricao, qtd_minima, qtd_maxima, max_um_de_cada, ativo, ordem)
  VALUES (v_tenant_id, 'Escolha o tamanho', 'TAMANHO BATATA', 1, 1, true, true, 1)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_id FROM categorias_complementos
  WHERE tenant_id = v_tenant_id AND descricao = 'TAMANHO BATATA';

  -- Cadastrar os tamanhos
  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Pequena', 15.00, 'Porção de batata frita com 100 g.'),
      ('Média', 20.00, 'Porção de batata frita com 200 g.'),
      ('Grande', 30.00, 'Porção de batata frita com 300 g.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );
  END LOOP;

  -- ============================================
  -- 4) CRIAR LISTA "SABOR PASTEL"
  -- ============================================
  INSERT INTO categorias_complementos (tenant_id, nome, descricao, qtd_minima, qtd_maxima, max_um_de_cada, ativo, ordem)
  VALUES (v_tenant_id, 'Escolha o sabor', 'SABOR PASTEL', 1, 1, true, true, 1)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_id FROM categorias_complementos
  WHERE tenant_id = v_tenant_id AND descricao = 'SABOR PASTEL';

  -- Cadastrar sabores
  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Carne', 25.00, 'Porção com 12 pastéis de carne.'),
      ('Queijo', 25.00, 'Porção com 12 pastéis de queijo.'),
      ('Frango', 25.00, 'Porção com 12 pastéis de frango.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );
  END LOOP;

  -- ============================================
  -- 5) CONSOLIDAR BATATA (desativar as 3 antigas, criar 1 só)
  -- ============================================
  -- Desativar as 3 Batatas antigas
  UPDATE produtos SET ativo = false
  WHERE tenant_id = v_tenant_id
  AND nome IN ('Batata Pequena', 'Batata Média', 'Batata Grande');

  -- Criar produto único "Batata" (preço base 0 — escolha do tamanho define o valor)
  SELECT id INTO v_prod_id FROM produtos
  WHERE tenant_id = v_tenant_id AND nome = 'Batata';

  IF v_prod_id IS NULL THEN
    INSERT INTO produtos (tenant_id, categoria_id, nome, preco, descricao, ativo, tempo_preparo_min, ordem)
    VALUES (
      v_tenant_id,
      (SELECT id FROM categorias WHERE tenant_id = v_tenant_id AND nome = 'Entradas'),
      'Batata',
      0,
      'Porção de batata frita disponível nos tamanhos pequeno, médio e grande.',
      true,
      20,
      1
    )
    RETURNING id INTO v_prod_id;
  END IF;

  -- Vincular Batata aos tamanhos
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT v_prod_id, c.id
  FROM complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE c.tenant_id = v_tenant_id
  AND cat.descricao = 'TAMANHO BATATA'
  ON CONFLICT DO NOTHING;

  -- Vincular Batata às Bebidas
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT v_prod_id, c.id
  FROM complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE c.tenant_id = v_tenant_id
  AND cat.descricao = 'BEBIDAS GERAL'
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 6) CRIAR PRODUTO "Pastel"
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos
  WHERE tenant_id = v_tenant_id AND nome = 'Pastel';

  IF v_prod_id IS NULL THEN
    INSERT INTO produtos (tenant_id, categoria_id, nome, preco, descricao, ativo, tempo_preparo_min, ordem)
    VALUES (
      v_tenant_id,
      (SELECT id FROM categorias WHERE tenant_id = v_tenant_id AND nome = 'Entradas'),
      'Pastel',
      0,
      'Porção com 12 unidades. Escolha o sabor.',
      true,
      20,
      2
    )
    RETURNING id INTO v_prod_id;
  END IF;

  -- Vincular Pastel aos sabores
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT v_prod_id, c.id
  FROM complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE c.tenant_id = v_tenant_id
  AND cat.descricao = 'SABOR PASTEL'
  ON CONFLICT DO NOTHING;

  -- Vincular Pastel às Bebidas
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT v_prod_id, c.id
  FROM complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE c.tenant_id = v_tenant_id
  AND cat.descricao = 'BEBIDAS GERAL'
  ON CONFLICT DO NOTHING;

END $$;

COMMIT;
