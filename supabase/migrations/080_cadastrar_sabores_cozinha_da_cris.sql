-- Migration 080: Cadastrar sabores de Pizza, Espaguete e Lasanha (Cozinha da Cris)
-- Cada sabor = 1 complemento vinculado a 1 categoria (lista) E ao produto

BEGIN;

DO $$
DECLARE
  v_tenant_id uuid := '475158ca-9e84-4d30-8167-5975306907dc';
  v_prod_id uuid;
  v_cat_id uuid;
  v_comp record;
BEGIN

  -- ============================================
  -- PIZZA PEQUENA
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Pizza Pequena';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'PIZZA 02 SABORES P';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Mussarela', 35.00, 'molho, mussarela, tomate, azeitona e orégano.'),
      ('Marguerita', 35.00, 'molho, mussarela, tomate, azeitona, orégano e manjericão fresco.'),
      ('Calabresa', 35.00, 'molho, mussarela, calabresa, cebola, azeitona e orégano.'),
      ('Napolitana', 35.00, 'molho, mussarela, peito de peru, tomate, azeitonas e orégano.'),
      ('Frango', 35.00, 'molho, mussarela, frango, milho, tomate, azeitonas e orégano.'),
      ('3 Queijos Tradicional', 35.00, 'molho, mussarela, Catupiry similar, cheddar similar e orégano.'),
      ('Frango com Catupiry', 35.00, 'molho, mussarela, frango, milho, Catupiry similar, azeitonas e orégano.'),
      ('Frango com Cheddar', 35.00, 'molho, mussarela, frango, cheddar similar, milho, azeitonas e orégano.'),
      ('Bacon', 35.00, 'molho, mussarela, bacon, cebola, azeitonas e orégano.'),
      ('Calabresa com Cheddar', 35.00, 'molho, mussarela, calabresa, cebola, azeitonas e orégano.'),
      ('Portuguesa', 35.00, 'molho, mussarela, presunto, ovos cozidos, tomate, pimentão, cebola, azeitonas e orégano.'),
      ('Chocolate', 35.00, 'creme de leite, mussarela, chocolate cremoso e raspas de chocolate.'),
      ('Banana Nevada', 35.00, 'creme de leite, mussarela, banana, chocolate branco, cream cheese e canela.'),
      ('Morango', 35.00, 'massa fresca, creme de avelã, morango e raspas de chocolate.'),
      ('Romeu e Julieta', 35.00, 'massa fresca, goiabada tipo cascão e queijo tipo mussarela.'),
      ('Carne de Sol', 40.00, 'molho, queijo, carne desfiada, cebola, azeitonas e orégano.'),
      ('Frango com Cheddar ou Requeijão', 40.00, 'molho, mussarela, frango, milho, azeitonas e orégano.'),
      ('Calabresa com Cheddar ou Requeijão', 40.00, 'molho, mussarela, calabresa, cebola, azeitonas e orégano.'),
      ('Frango Cremoso', 40.00, 'molho, mussarela, frango cremoso, azeitonas e orégano.'),
      ('Frango com Bacon', 40.00, 'molho, mussarela, frango, milho, azeitonas, orégano e bacon.'),
      ('Calabresa com Fritas', 40.00, 'molho, mussarela, calabresa, cebola, azeitona, orégano e fritas.'),
      ('3 Queijos Especial', 40.00, 'molho, mussarela, requeijão, cheddar e orégano.'),
      ('Quatro Queijos', 40.00, 'molho, mussarela, requeijão, cheddar, parmesão e orégano.'),
      ('Calabresa 3 Queijos', 40.00, 'molho, mussarela, calabresa, requeijão, cheddar, cebola e orégano.'),
      ('Frango com Cream Cheese', 40.00, 'molho, mussarela, frango, milho, cream cheese, barbecue, azeitona e orégano.'),
      ('Carne de Sol com Requeijão', 45.00, 'molho, mussarela, carne desfiada, requeijão, cebola e azeitona.'),
      ('Carne de Sol com Cream Cheese', 45.00, 'molho, mussarela, carne desfiada, cream cheese, cebola e azeitona.'),
      ('Carne de Sol 3 Queijos', 45.00, 'molho, mussarela, carne desfiada, requeijão, cheddar, cebola e azeitona.'),
      ('Carne de Sol com Queijo Coalho', 45.00, 'molho, mussarela, carne desfiada, tomate, queijo coalho e azeitona.'),
      ('Nordestina', 45.00, 'molho, mussarela, carne desfiada, tomate, queijo coalho, geleia e azeitona.'),
      ('Costela com Requeijão', 45.00, 'molho, mussarela, costela desfiada, requeijão, cebola e azeitona.'),
      ('Costela com Cream Cheese', 45.00, 'molho, mussarela, costela desfiada, cream cheese, barbecue, cebola e azeitona.'),
      ('Camarão', 45.00, 'molho, mussarela, camarão ao alho, tomate, azeitona e orégano.'),
      ('Filé Mignon Acebolado', 45.00, 'molho, mussarela, filé ao alho, cebola, azeitona e orégano.'),
      ('Calabresa Especial', 45.00, 'molho, mussarela, calabresa, queijo coalho com geleia, cebola, azeitona e orégano.'),
      ('Carne de Sol Suprema', 45.00, 'molho, mussarela, presunto, carne de sol, queijo coalho, requeijão, cebola, geleia de pimenta e orégano.'),
      ('Carne de Sol com Banana', 45.00, 'molho, mussarela, carne de sol, banana, queijo coalho, requeijão, cebola e orégano.'),
      ('Frango Supremo', 45.00, 'molho, mussarela, frango, banana, requeijão, queijo coalho, geleia de pimenta, bacon, mel e orégano.'),
      ('Costela com Barbecue', 45.00, 'molho, mussarela, costela, cream cheese, queijo coalho, barbecue, cebola, azeitonas e orégano.'),
      ('Carne de Sol com Fritas', 45.00, 'molho, mussarela, carne de sol, cebola, azeitonas, orégano e fritas.'),
      ('Filé com Fritas', 50.00, 'molho, mussarela, filé, cebola, azeitonas, orégano e fritas.'),
      ('Filé com Requeijão', 48.00, 'Molho, mussarela, filé e requeijão. (descrição do cardápio diverge da impressão — revisar)'),
      ('Filé com Cream Cheese', 48.00, 'molho, mussarela, filé, cream cheese, cebola, azeitonas e orégano.'),
      ('Camarão com Cream Cheese', 48.00, 'molho, mussarela, camarão, cream cheese, azeitonas e orégano.'),
      ('Camarão com Requeijão', 48.00, 'molho, mussarela, camarão, requeijão, azeitonas e orégano.'),
      ('Mexicana', 44.00, 'molho, calabresa, presunto, bacon picado, queijo coalho, geleia de pimenta, cebola, pimentão, azeitonas e orégano.'),
      ('Lombo Canadense', 48.00, 'molho, mussarela, lombo, tomate, azeitonas, queijo coalho e orégano.'),
      ('Moda da Casa', 48.00, 'molho, mussarela, presunto, calabresa, ovos, bacon, requeijão, cebola, azeitonas e orégano.'),
      ('Pepperoni', 48.00, 'molho, mussarela, pepperoni, requeijão, azeitona e orégano.')
    ) AS t(nome, preco, descricao)
  LOOP
    -- Insere complemento se não existir
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    -- Vincula o complemento ao produto
    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- PIZZA MÉDIA
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Pizza Média';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'PIZZA 02 SABORES M';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Mussarela', 40.00, 'molho, mussarela, tomate, azeitona e orégano.'),
      ('Marguerita', 40.00, 'molho, mussarela, tomate, azeitona, orégano e manjericão fresco.'),
      ('Calabresa', 40.00, 'molho, mussarela, calabresa, cebola, azeitona e orégano.'),
      ('Napolitana', 40.00, 'molho, mussarela, peito de peru, tomate, azeitonas e orégano.'),
      ('Frango', 40.00, 'molho, mussarela, frango, milho, tomate, azeitonas e orégano.'),
      ('3 Queijos Tradicional', 40.00, 'molho, mussarela, Catupiry similar, cheddar similar e orégano.'),
      ('Frango com Catupiry', 40.00, 'molho, mussarela, frango, milho, Catupiry similar, azeitonas e orégano.'),
      ('Frango com Cheddar', 40.00, 'molho, mussarela, frango, cheddar similar, milho, azeitonas e orégano.'),
      ('Bacon', 40.00, 'molho, mussarela, bacon, cebola, azeitonas e orégano.'),
      ('Calabresa com Cheddar', 40.00, 'molho, mussarela, calabresa, cebola, azeitonas e orégano.'),
      ('Portuguesa', 40.00, 'molho, mussarela, presunto, ovos cozidos, tomate, pimentão, cebola, azeitonas e orégano.'),
      ('Chocolate', 45.00, 'creme de leite, mussarela, chocolate cremoso e raspas de chocolate.'),
      ('Banana Nevada', 45.00, 'creme de leite, mussarela, banana, chocolate branco, cream cheese e canela.'),
      ('Morango', 45.00, 'massa fresca, creme de avelã, morango e raspas de chocolate.'),
      ('Romeu e Julieta', 45.00, 'massa fresca, goiabada tipo cascão e queijo tipo mussarela.'),
      ('Carne de Sol', 46.00, 'molho, queijo, carne desfiada, cebola, azeitonas e orégano.'),
      ('Frango com Cheddar ou Requeijão', 46.00, 'molho, mussarela, frango, milho, azeitonas e orégano.'),
      ('Calabresa com Cheddar ou Requeijão', 46.00, 'molho, mussarela, calabresa, cebola, azeitonas e orégano.'),
      ('Frango Cremoso', 46.00, 'molho, mussarela, frango cremoso, azeitonas e orégano.'),
      ('Frango com Bacon', 46.00, 'molho, mussarela, frango, milho, azeitonas, orégano e bacon.'),
      ('Calabresa com Fritas', 46.00, 'molho, mussarela, calabresa, cebola, azeitona, orégano e fritas.'),
      ('3 Queijos Especial', 46.00, 'molho, mussarela, requeijão, cheddar e orégano.'),
      ('Quatro Queijos', 46.00, 'molho, mussarela, requeijão, cheddar, parmesão e orégano.'),
      ('Calabresa 3 Queijos', 46.00, 'molho, mussarela, calabresa, requeijão, cheddar, cebola e orégano.'),
      ('Frango com Cream Cheese', 46.00, 'molho, mussarela, frango, milho, cream cheese, barbecue, azeitona e orégano.'),
      ('Carne de Sol com Requeijão', 55.00, 'molho, mussarela, carne desfiada, requeijão, cebola e azeitona.'),
      ('Carne de Sol com Cream Cheese', 55.00, 'molho, mussarela, carne desfiada, cream cheese, cebola e azeitona.'),
      ('Carne de Sol 3 Queijos', 55.00, 'molho, mussarela, carne desfiada, requeijão, cheddar, cebola e azeitona.'),
      ('Carne de Sol com Queijo Coalho', 55.00, 'molho, mussarela, carne desfiada, tomate, queijo coalho e azeitona.'),
      ('Nordestina', 55.00, 'molho, mussarela, carne desfiada, tomate, queijo coalho, geleia e azeitona.'),
      ('Costela com Requeijão', 55.00, 'molho, mussarela, costela desfiada, requeijão, cebola e azeitona.'),
      ('Costela com Cream Cheese', 55.00, 'molho, mussarela, costela desfiada, cream cheese, barbecue, cebola e azeitona.'),
      ('Camarão', 55.00, 'molho, mussarela, camarão ao alho, tomate, azeitona e orégano.'),
      ('Filé Mignon Acebolado', 55.00, 'molho, mussarela, filé ao alho, cebola, azeitona e orégano.'),
      ('Calabresa Especial', 55.00, 'molho, mussarela, calabresa, queijo coalho com geleia, cebola, azeitona e orégano.'),
      ('Carne de Sol Suprema', 55.00, 'molho, mussarela, presunto, carne de sol, queijo coalho, requeijão, cebola, geleia de pimenta e orégano.'),
      ('Carne de Sol com Banana', 55.00, 'molho, mussarela, carne de sol, banana, queijo coalho, requeijão, cebola e orégano.'),
      ('Frango Supremo', 55.00, 'molho, mussarela, frango, banana, requeijão, queijo coalho, geleia de pimenta, bacon, mel e orégano.'),
      ('Costela com Barbecue', 55.00, 'molho, mussarela, costela, cream cheese, queijo coalho, barbecue, cebola, azeitonas e orégano.'),
      ('Carne de Sol com Fritas', 53.00, 'molho, mussarela, carne de sol, cebola, azeitonas, orégano e fritas.'),
      ('Filé com Fritas', 60.00, 'molho, mussarela, filé, cebola, azeitonas, orégano e fritas.'),
      ('Filé com Requeijão', 59.00, 'Molho, mussarela, filé e requeijão. (descrição do cardápio diverge da impressão — revisar)'),
      ('Filé com Cream Cheese', 58.00, 'molho, mussarela, filé, cream cheese, cebola, azeitonas e orégano.'),
      ('Camarão com Cream Cheese', 58.00, 'molho, mussarela, camarão, cream cheese, azeitonas e orégano.'),
      ('Camarão com Requeijão', 58.00, 'molho, mussarela, camarão, requeijão, azeitonas e orégano.'),
      ('Mexicana', 54.00, 'molho, calabresa, presunto, bacon picado, queijo coalho, geleia de pimenta, cebola, pimentão, azeitonas e orégano.'),
      ('Lombo Canadense', 58.00, 'molho, mussarela, lombo, tomate, azeitonas, queijo coalho e orégano.'),
      ('Moda da Casa', 58.00, 'molho, mussarela, presunto, calabresa, ovos, bacon, requeijão, cebola, azeitonas e orégano.'),
      ('Pepperoni', 58.00, 'molho, mussarela, pepperoni, requeijão, azeitona e orégano.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- PIZZA GRANDE
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Pizza Grande';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'PIZZA 03 SABORES G';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Mussarela', 45.00, 'molho, mussarela, tomate, azeitona e orégano.'),
      ('Marguerita', 46.00, 'molho, mussarela, tomate, azeitona, orégano e manjericão fresco.'),
      ('Calabresa', 46.00, 'molho, mussarela, calabresa, cebola, azeitona e orégano.'),
      ('Napolitana', 47.00, 'molho, mussarela, peito de peru, tomate, azeitonas e orégano.'),
      ('Frango', 45.00, 'molho, mussarela, frango, milho, tomate, azeitonas e orégano.'),
      ('3 Queijos Tradicional', 46.00, 'molho, mussarela, Catupiry similar, cheddar similar e orégano.'),
      ('Frango com Catupiry', 47.00, 'molho, mussarela, frango, milho, Catupiry similar, azeitonas e orégano.'),
      ('Frango com Cheddar', 47.00, 'molho, mussarela, frango, cheddar similar, milho, azeitonas e orégano.'),
      ('Bacon', 48.00, 'molho, mussarela, bacon, cebola, azeitonas e orégano.'),
      ('Calabresa com Cheddar', 48.00, 'molho, mussarela, calabresa, cebola, azeitonas e orégano.'),
      ('Portuguesa', 48.00, 'molho, mussarela, presunto, ovos cozidos, tomate, pimentão, cebola, azeitonas e orégano.'),
      ('Chocolate', 55.00, 'creme de leite, mussarela, chocolate cremoso e raspas de chocolate.'),
      ('Banana Nevada', 50.00, 'creme de leite, mussarela, banana, chocolate branco, cream cheese e canela.'),
      ('Morango', 65.00, 'massa fresca, creme de avelã, morango e raspas de chocolate.'),
      ('Romeu e Julieta', 49.00, 'massa fresca, goiabada tipo cascão e queijo tipo mussarela.'),
      ('Carne de Sol', 54.00, 'molho, queijo, carne desfiada, cebola, azeitonas e orégano.'),
      ('Frango com Cheddar ou Requeijão', 54.00, 'molho, mussarela, frango, milho, azeitonas e orégano.'),
      ('Calabresa com Cheddar ou Requeijão', 54.00, 'molho, mussarela, calabresa, cebola, azeitonas e orégano.'),
      ('Frango Cremoso', 56.00, 'molho, mussarela, frango cremoso, azeitonas e orégano.'),
      ('Frango com Bacon', 59.00, 'molho, mussarela, frango, milho, azeitonas, orégano e bacon.'),
      ('Calabresa com Fritas', 58.00, 'molho, mussarela, calabresa, cebola, azeitona, orégano e fritas.'),
      ('3 Queijos Especial', 54.00, 'molho, mussarela, requeijão, cheddar e orégano.'),
      ('Quatro Queijos', 60.00, 'molho, mussarela, requeijão, cheddar, parmesão e orégano.'),
      ('Calabresa 3 Queijos', 58.00, 'molho, mussarela, calabresa, requeijão, cheddar, cebola e orégano.'),
      ('Frango com Cream Cheese', 58.00, 'molho, mussarela, frango, milho, cream cheese, barbecue, azeitona e orégano.'),
      ('Carne de Sol com Requeijão', 62.00, 'molho, mussarela, carne desfiada, requeijão, cebola e azeitona.'),
      ('Carne de Sol com Cream Cheese', 62.00, 'molho, mussarela, carne desfiada, cream cheese, cebola e azeitona.'),
      ('Carne de Sol 3 Queijos', 62.00, 'molho, mussarela, carne desfiada, requeijão, cheddar, cebola e azeitona.'),
      ('Carne de Sol com Queijo Coalho', 62.00, 'molho, mussarela, carne desfiada, tomate, queijo coalho e azeitona.'),
      ('Nordestina', 62.00, 'molho, mussarela, carne desfiada, tomate, queijo coalho, geleia e azeitona.'),
      ('Costela com Requeijão', 62.00, 'molho, mussarela, costela desfiada, requeijão, cebola e azeitona.'),
      ('Costela com Cream Cheese', 62.00, 'molho, mussarela, costela desfiada, cream cheese, barbecue, cebola e azeitona.'),
      ('Camarão', 62.00, 'molho, mussarela, camarão ao alho, tomate, azeitona e orégano.'),
      ('Filé Mignon Acebolado', 62.00, 'molho, mussarela, filé ao alho, cebola, azeitona e orégano.'),
      ('Calabresa Especial', 62.00, 'molho, mussarela, calabresa, queijo coalho com geleia, cebola, azeitona e orégano.'),
      ('Carne de Sol Suprema', 68.00, 'molho, mussarela, presunto, carne de sol, queijo coalho, requeijão, cebola, geleia de pimenta e orégano.'),
      ('Carne de Sol com Banana', 68.00, 'molho, mussarela, carne de sol, banana, queijo coalho, requeijão, cebola e orégano.'),
      ('Frango Supremo', 68.00, 'molho, mussarela, frango, banana, requeijão, queijo coalho, geleia de pimenta, bacon, mel e orégano.'),
      ('Costela com Barbecue', 68.00, 'molho, mussarela, costela, cream cheese, queijo coalho, barbecue, cebola, azeitonas e orégano.'),
      ('Carne de Sol com Fritas', 63.00, 'molho, mussarela, carne de sol, cebola, azeitonas, orégano e fritas.'),
      ('Filé com Fritas', 70.00, 'molho, mussarela, filé, cebola, azeitonas, orégano e fritas.'),
      ('Filé com Requeijão', 68.00, 'Molho, mussarela, filé e requeijão. (descrição do cardápio diverge da impressão — revisar)'),
      ('Filé com Cream Cheese', 68.00, 'molho, mussarela, filé, cream cheese, cebola, azeitonas e orégano.'),
      ('Camarão com Cream Cheese', 68.00, 'molho, mussarela, camarão, cream cheese, azeitonas e orégano.'),
      ('Camarão com Requeijão', 68.00, 'molho, mussarela, camarão, requeijão, azeitonas e orégano.'),
      ('Mexicana', 64.00, 'molho, calabresa, presunto, bacon picado, queijo coalho, geleia de pimenta, cebola, pimentão, azeitonas e orégano.'),
      ('Lombo Canadense', 68.00, 'molho, mussarela, lombo, tomate, azeitonas, queijo coalho e orégano.'),
      ('Moda da Casa', 68.00, 'molho, mussarela, presunto, calabresa, ovos, bacon, requeijão, cebola, azeitonas e orégano.'),
      ('Pepperoni', 68.00, 'molho, mussarela, pepperoni, requeijão, azeitona e orégano.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- ESPAGUETE PEQUENO
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Espaguete Pequeno';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'ESPAGUETE P';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Macarronada de Carne', 30.00, 'Peso: 600 g. Macarrão espaguete, molho de carne moída, molho branco, presunto, salsicha e queijo.'),
      ('Espaguete à Bolonhesa', 28.00, 'Peso: 500 g. Molho de carne moída cozido lentamente com tomates e ervas, bastante mussarela e molho branco opcional.'),
      ('Espaguete de Frango', 27.00, 'Peso: 500 g. Frango desfiado ao molho branco, muita mussarela e orégano.'),
      ('Frango Cremoso com Bacon', 35.00, 'Peso: 550 g. Frango desfiado ao molho branco, muita mussarela, bacon e orégano.'),
      ('Espaguete de Camarão', 37.00, 'Peso: 600 g. Camarões ao alho, alecrim e manjericão, servidos ao molho branco e com muita mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- ESPAGUETE MÉDIO
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Espaguete Médio';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'ESPAGUETE M';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Macarronada de Carne', 40.00, 'Peso: 900 g. Macarrão espaguete, molho de carne moída, molho branco, presunto, salsicha e queijo.'),
      ('Espaguete à Bolonhesa', 35.00, 'Peso: 800 g. Molho de carne moída cozido lentamente com tomates e ervas, bastante mussarela e molho branco opcional.'),
      ('Espaguete de Frango', 35.00, 'Peso: 800 g. Frango desfiado ao molho branco, muita mussarela e orégano.'),
      ('Frango Cremoso com Bacon', 45.00, 'Peso: 850 g. Frango desfiado ao molho branco, muita mussarela, bacon e orégano.'),
      ('Espaguete de Camarão', 50.00, 'Peso: 800 g. Camarões ao alho, alecrim e manjericão, servidos ao molho branco e com muita mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- ESPAGUETE GRANDE
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Espaguete Grande';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'ESPAGUETE G';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Macarronada de Carne', 50.00, 'Peso: 1,3 kg. Macarrão espaguete, molho de carne moída, molho branco, presunto, salsicha e queijo.'),
      ('Espaguete à Bolonhesa', 45.00, 'Peso: 1,2 kg. Molho de carne moída cozido lentamente com tomates e ervas, bastante mussarela e molho branco opcional.'),
      ('Espaguete de Frango', 45.00, 'Peso: 1,2 kg. Frango desfiado ao molho branco, muita mussarela e orégano.'),
      ('Frango Cremoso com Bacon', 54.00, 'Peso: 1,2 kg. Frango desfiado ao molho branco, muita mussarela, bacon e orégano.'),
      ('Espaguete de Camarão', 70.00, 'Peso: 1,3 kg. Camarões ao alho, alecrim e manjericão, servidos ao molho branco e com muita mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- LASANHA PEQUENA
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Lasanha Pequena';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'LASANHA P';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Lasanha de Carne', 32.00, 'Peso: 550 g. Massa de lasanha com carne, molho branco, presunto de peru e mussarela.'),
      ('Lasanha de Frango', 30.00, 'Peso: 500 g. Lasanha de frango ao molho branco e ervas, com presunto e mussarela.'),
      ('Lasanha de Camarão', 45.00, 'Peso: 550 g. Camarão fresco no alho e azeite, com ervas, camadas de massa de lasanha, bastante molho branco e mussarela.'),
      ('Lasanha de Frango Cremoso', 35.00, 'Peso: 550 g. Lasanha cremosa de frango com molho branco, presunto e muita mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- LASANHA MÉDIA
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Lasanha Média';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'LASANHA M';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Lasanha de Carne', 45.00, 'Peso: 850 g. Massa de lasanha com carne, molho branco, presunto de peru e mussarela.'),
      ('Lasanha de Frango', 42.00, 'Peso: 800 g. Lasanha de frango ao molho branco e ervas, com presunto e mussarela.'),
      ('Lasanha de Camarão', 65.00, 'Peso: 850 g. Camarão fresco no alho e azeite, com ervas, camadas de massa de lasanha, bastante molho branco e mussarela.'),
      ('Lasanha de Frango Cremoso', 49.00, 'Peso: 850 g. Lasanha cremosa de frango com molho branco, presunto e muita mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ============================================
  -- LASANHA GRANDE
  -- ============================================
  SELECT id INTO v_prod_id FROM produtos WHERE tenant_id = v_tenant_id AND nome = 'Lasanha Grande';
  SELECT id INTO v_cat_id FROM categorias_complementos WHERE tenant_id = v_tenant_id AND descricao = 'LASANHA G';

  FOR v_comp IN
    SELECT * FROM (VALUES
      ('Lasanha de Carne', 69.00, 'Peso: 1,3 kg. Massa de lasanha com carne, molho branco, presunto de peru e mussarela.'),
      ('Lasanha de Frango', 65.00, 'Peso: 1,2 kg. Lasanha de frango ao molho branco e ervas, com presunto e mussarela.'),
      ('Lasanha de Camarão', 80.00, 'Peso: 1,3 kg. Camarão fresco no alho e azeite, com ervas, camadas de massa de lasanha, bastante molho branco e mussarela.'),
      ('Lasanha de Frango Cremoso', 69.00, 'Peso: 1,3 kg. Lasanha cremosa de frango com molho branco, presunto e muita mussarela.')
    ) AS t(nome, preco, descricao)
  LOOP
    INSERT INTO complementos (tenant_id, categoria_id, nome, preco, descricao, ativo)
    SELECT v_tenant_id, v_cat_id, v_comp.nome, v_comp.preco, v_comp.descricao, true
    WHERE NOT EXISTS (
      SELECT 1 FROM complementos WHERE tenant_id = v_tenant_id AND categoria_id = v_cat_id AND nome = v_comp.nome
    );

    INSERT INTO produto_complementos (produto_id, complemento_id)
    SELECT v_prod_id, c.id FROM complementos c
    WHERE c.tenant_id = v_tenant_id AND c.categoria_id = v_cat_id AND c.nome = v_comp.nome
    ON CONFLICT DO NOTHING;
  END LOOP;

END $$;

COMMIT;
