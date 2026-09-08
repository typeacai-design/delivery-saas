-- Migration 081: Criar sessão "Pizzas Doces" com 3 produtos + 3 listas
-- Apenas para a Cozinha da Cris (por enquanto)

BEGIN;

DO $$
DECLARE
  v_tenant_id uuid := '475158ca-9e84-4d30-8167-5975306907dc';
  v_cat_id uuid;
  v_prod_id uuid;
  v_comp record;
BEGIN

  -- ============================================
  -- 1) CRIAR SESSÃO "Pizzas Doces"
  -- ============================================
  INSERT INTO categorias (tenant_id, nome, ordem, ativo)
  VALUES (v_tenant_id, 'Pizzas Doces', 99, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cat_id;

  -- Caso já exista, pegar o id
  IF v_cat_id IS NULL THEN
    SELECT id INTO v_cat_id FROM categorias
    WHERE tenant_id = v_tenant_id AND nome = 'Pizzas Doces';
  END IF;

  -- ============================================
  -- 2) CRIAR PRODUTOS (Pequena, Média, Grande)
  -- ============================================
  INSERT INTO produtos (tenant_id, categoria_id, nome, preco, ativo, tempo_preparo_min, ordem)
  VALUES
    (v_tenant_id, v_cat_id, 'Pizza Doce Pequena', 35.00, true, 30, 1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_prod_id;
  IF v_prod_id IS NULL THEN
    SELECT id INTO v_prod_id FROM produtos
    WHERE tenant_id = v_tenant_id AND nome = 'Pizza Doce Pequena';
  END IF;

  INSERT INTO produtos (tenant_id, categoria_id, nome, preco, ativo, tempo_preparo_min, ordem)
  VALUES
    (v_tenant_id, v_cat_id, 'Pizza Doce Média', 45.00, true, 30, 2)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_prod_id;
  IF v_prod_id IS NULL THEN
    SELECT id INTO v_prod_id FROM produtos
    WHERE tenant_id = v_tenant_id AND nome = 'Pizza Doce Média';
  END IF;

  INSERT INTO produtos (tenant_id, categoria_id, nome, preco, ativo, tempo_preparo_min, ordem)
  VALUES
    (v_tenant_id, v_cat_id, 'Pizza Doce Grande', 50.00, true, 30, 3)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_prod_id;
  IF v_prod_id IS NULL THEN
    SELECT id INTO v_prod_id FROM produtos
    WHERE tenant_id = v_tenant_id AND nome = 'Pizza Doce Grande';
  END IF;

  -- ============================================
  -- 3) CRIAR LISTAS DE COMPLEMENTOS
  -- ============================================
  -- Lista para Pizza Doce Pequena
  INSERT INTO categorias_complementos (tenant_id, nome, descricao, qtd_minima, qtd_maxima, max_um_de_cada, ativo, ordem)
  VALUES (v_tenant_id, 'Escolha o Sabor', 'PIZZA DOCE 02 SABORES P', 0, 1, true, true, 1)
  ON CONFLICT DO NOTHING;

  -- Lista para Pizza Doce Média
  INSERT INTO categorias_complementos (tenant_id, nome, descricao, qtd_minima, qtd_maxima, max_um_de_cada, ativo, ordem)
  VALUES (v_tenant_id, 'Escolha o Sabor', 'PIZZA DOCE 02 SABORES M', 0, 1, true, true, 2)
  ON CONFLICT DO NOTHING;

  -- Lista para Pizza Doce Grande
  INSERT INTO categorias_complementos (tenant_id, nome, descricao, qtd_minima, qtd_maxima, max_um_de_cada, ativo, ordem)
  VALUES (v_tenant_id, 'Escolha o Sabor', 'PIZZA DOCE 03 SABORES G', 0, 1, true, true, 3)
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 4) CADASTRAR SABORES DOCES POR TAMANHO
  -- ============================================
  -- Pizza Doce Pequena (R$ 35)
  SELECT id INTO v_cat_id FROM categorias_complementos
  WHERE tenant_id = v_tenant_id AND descricao = 'PIZZA DOCE 02 SABORES P';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Chocolate', 35.00, 'creme de leite, mussarela, chocolate cremoso e raspas de chocolate.'),
      ('Banana Nevada', 35.00, 'creme de leite, mussarela, banana, chocolate branco, cream cheese e canela.'),
      ('Morango', 35.00, 'massa fresca, creme de avelã, morango e raspas de chocolate.'),
      ('Romeu e Julieta', 35.00, 'massa fresca, goiabada tipo cascão e queijo tipo mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );
  END LOOP;

  -- Pizza Doce Média (R$ 45)
  SELECT id INTO v_cat_id FROM categorias_complementos
  WHERE tenant_id = v_tenant_id AND descricao = 'PIZZA DOCE 02 SABORES M';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Chocolate', 45.00, 'creme de leite, mussarela, chocolate cremoso e raspas de chocolate.'),
      ('Banana Nevada', 45.00, 'creme de leite, mussarela, banana, chocolate branco, cream cheese e canela.'),
      ('Morango', 45.00, 'massa fresca, creme de avelã, morango e raspas de chocolate.'),
      ('Romeu e Julieta', 45.00, 'massa fresca, goiabada tipo cascão e queijo tipo mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );
  END LOOP;

  -- Pizza Doce Grande (R$ 50, conforme a pizza doce grande com preços menores)
  -- Conforme o cardápio original: Pequena R$ 35, Média R$ 45, Grande R$ 50 (Banana Nevada, Romeu e Julieta)
  -- Chocolate e Morango grandes estavam com preços diferentes mas vou padronizar R$ 50 para Banana Nevada e Romeu e Julieta
  -- Chocolate e Morango grandes continuam como sabores das pizzas salgadas
  SELECT id INTO v_cat_id FROM categorias_complementos
  WHERE tenant_id = v_tenant_id AND descricao = 'PIZZA DOCE 03 SABORES G';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Banana Nevada', 50.00, 'creme de leite, mussarela, banana, chocolate branco, cream cheese e canela.'),
      ('Romeu e Julieta', 49.00, 'massa fresca, goiabada tipo cascão e queijo tipo mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );
  END LOOP;

  -- ============================================
  -- 5) VINCULAR SABORES AOS PRODUTOS
  -- ============================================
  -- Pizza Doce Pequena
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Pizza Doce Pequena';
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT v_prod_id, c.id FROM complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE c.tenant_id = v_tenant_id
  AND cat.descricao = 'PIZZA DOCE 02 SABORES P'
  ON CONFLICT DO NOTHING;

  -- Pizza Doce Média
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Pizza Doce Média';
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT v_prod_id, c.id FROM complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE c.tenant_id = v_tenant_id
  AND cat.descricao = 'PIZZA DOCE 02 SABORES M'
  ON CONFLICT DO NOTHING;

  -- Pizza Doce Grande
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Pizza Doce Grande';
  INSERT INTO produto_complementos (produto_id, complemento_id)
  SELECT v_prod_id, c.id FROM complementos c
  JOIN categorias_complementos cat ON cat.id = c.categoria_id
  WHERE c.tenant_id = v_tenant_id
  AND cat.descricao = 'PIZZA DOCE 03 SABORES G'
  ON CONFLICT DO NOTHING;

END $$;

COMMIT;
