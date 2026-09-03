-- =====================================================
-- Migration 061: Corrigir criar_pedido_atomico para incluir pontos
-- Data: 2026-09-03
-- =====================================================

-- Primeiro, verificar se a coluna pontos já existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens'
    AND column_name = 'pontos'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN pontos INTEGER DEFAULT 0;
  END IF;
END $$;

-- Atualizar a função criar_pedido_atomico para incluir pontos
CREATE OR REPLACE FUNCTION criar_pedido_atomico(
  p_tenant_id UUID,
  p_token_hash TEXT,
  p_idempotency_hash TEXT,
  p_cliente JSONB,
  p_pedido JSONB,
  p_itens JSONB,
  p_ignorar_estoque BOOLEAN DEFAULT false,
  p_convite_codigo TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_cliente_id UUID;
  v_status TEXT;
  v_idempotency TEXT;
  v_cupom كوبون%ROWTYPE;
  r RECORD;
  v_exists BOOLEAN;
  v_forma_pagamento TEXT;
BEGIN
  -- Verificar idempotência
  SELECT EXISTS(SELECT 1 FROM idempotency_keys WHERE hash=p_idempotency_hash AND tenant_id=p_tenant_id) INTO v_exists;
  IF v_exists THEN
    SELECT status INTO v_status FROM idempotency_keys WHERE hash=p_idempotency_hash AND tenant_id=p_tenant_id;
    IF v_status = 'completed' THEN
      SELECT id,codigo INTO v_pedido FROM pedidos WHERE tenant_id=p_tenant_id AND idempotency_hash=p_idempotency_hash LIMIT 1;
      RETURN jsonb_build_object('id',v_pedido.id,'codigo',v_pedido.codigo,'status',v_pedido.status,'valor_subtotal',v_pedido.valor_subtotal,'taxa_entrega',v_pedido.taxa_entrega,'valor_desconto',v_pedido.valor_desconto,'valor_total',v_pedido.valor_total,'tipo_entrega',v_pedido.tipo_entrega,'forma_pagamento',v_pedido.forma_pagamento);
    END IF;
    RAISE EXCEPTION 'Operacao em andamento';
  END IF;

  INSERT INTO idempotency_keys(hash,tenant_id,status) VALUES(p_idempotency_hash,p_tenant_id,'processing');

  -- Encontrar ou criar cliente
  SELECT id INTO v_cliente_id FROM clientes WHERE tenant_id=p_tenant_id AND acesso_token_hash=p_token_hash;
  IF NOT FOUND THEN
    INSERT INTO clientes(id,tenant_id,nome,telefone,endereco,data_nascimento,cpf,acesso_token_hash)
    VALUES(gen_random_uuid(),p_tenant_id,p_cliente->>'nome',p_cliente->>'telefone',p_cliente->>'endereco',NULLIF(p_cliente->>'data_nascimento','')::date,NULLIF(p_cliente->>'cpf',''),p_token_hash)
    RETURNING id INTO v_cliente_id;
  ELSE
    UPDATE clientes SET nome=COALESCE(p_cliente->>'nome',nome),telefone=COALESCE(p_cliente->>'telefone',telefone),endereco=COALESCE(p_cliente->>'endereco',endereco) WHERE id=v_cliente_id;
  END IF;

  -- Validar cupom
  IF p_pedido->>'cupom_aplicado' IS NOT NULL AND p_pedido->>'cupom_aplicado' <> '' THEN
    SELECT * INTO v_cupom FROM cupons WHERE tenant_id=p_tenant_id AND codigo=p_pedido->>'cupom_aplicado' AND ativo=true FOR UPDATE;
    IF NOT FOUND OR (v_cupom.validade IS NOT NULL AND v_cupom.validade<current_date) OR (v_cupom.max_usos IS NOT NULL AND coalesce(v_cupom.usos_atuais,0)>=v_cupom.max_usos) THEN RAISE EXCEPTION 'cupom_indisponivel'; END IF;
    UPDATE cupons SET usos_atuais=coalesce(usos_atuais,0)+1 WHERE id=v_cupom.id;
  END IF;

  -- Inserir pedido com pontos dos itens
  INSERT INTO pedidos(
    tenant_id,cliente_id,cliente_nome,cliente_whatsapp,
    valor_subtotal,taxa_entrega,valor_desconto,valor_total,
    forma_pagamento,troco_para,
    bairro_entrega,endereco_entrega,numero_entrega,complemento_entrega,
    tipo_entrega,observacoes,cupom_aplicado,
    status,idempotency_hash,
    cliente_acesso_token_hash,
   -- Dados do convite se aplicável
    convite_codigo
  ) VALUES (
    p_tenant_id, v_cliente_id,
    p_cliente->>'nome', p_cliente->>'telefone',
    (p_pedido->>'valor_subtotal')::numeric, (p_pedido->>'taxa_entrega')::numeric, (p_pedido->>'valor_desconto')::numeric, (p_pedido->>'valor_total')::numeric,
    COALESCE(p_pedido->>'formas_pagamento', p_pedido->>'forma_pagamento', '[]'::jsonb)::jsonb,
    NULLIF(p_pedido->>'troco_para','')::numeric,
    NULLIF(p_pedido->>'bairro_entrega',''), NULLIF(p_pedido->>'endereco_entrega',''), NULLIF(p_pedido->>'numero_entrega',''), NULLIF(p_pedido->>'complemento_entrega',''),
    COALESCE(NULLIF(p_pedido->>'tipo_entrega',''),'delivery'), NULLIF(p_pedido->>'observacoes',''),
    NULLIF(p_pedido->>'cupom_aplicado',''),
    'novo', p_idempotency_hash, p_token_hash,
    p_convite_codigo
  )
  RETURNING * INTO v_pedido;

  -- Inserir itens com pontos
  INSERT INTO pedido_itens(pedido_id,produto_id,nome,quantidade,valor_unitario,variante_id,variante_nome,complementos,observacao,pontos)
  SELECT
    v_pedido.id,
    (i->>'produto_id')::uuid,
    i->>'nome',
    (i->>'quantidade')::int,
    (i->>'valor_unitario')::numeric,
    nullif(i->>'variante_id','')::uuid,
    nullif(i->>'variante_nome',''),
    coalesce(i->'complementos','[]'::jsonb),
    nullif(i->>'observacao',''),
    coalesce((i->>'pontos')::int, 0)
  FROM jsonb_array_elements(p_itens) i;

  -- Baixa de estoque dos produtos
  IF NOT p_ignorar_estoque THEN
    FOR r IN SELECT p.id,sum((i->>'quantidade')::int) qtd FROM jsonb_array_elements(p_itens)i JOIN produtos p ON p.id=(i->>'produto_id')::uuid WHERE p.tenant_id=p_tenant_id AND p.controlar_estoque=true GROUP BY p.id LOOP
      UPDATE produtos SET quantidade_estoque=quantidade_estoque-r.qtd WHERE id=r.id AND tenant_id=p_tenant_id AND quantidade_estoque>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_produto_insuficiente'; END IF;
    END LOOP;
  END IF;

  -- Baixa de estoque dos complementos
  IF NOT p_ignorar_estoque THEN
    FOR r IN
      SELECT c.id,sum((i->>'quantidade')::int * jsonb_array_length(i->'complementos')) qtd
      FROM jsonb_array_elements(p_itens) i, jsonb_array_elements(i->'complementos') c
      JOIN complementos c ON c.id=(c->>'id')::uuid
      WHERE c.tenant_id=p_tenant_id AND c.controlar_estoque=true
      GROUP BY c.id
    LOOP
      UPDATE complementos SET quantidade_estoque=quantidade_estoque-r.qtd WHERE id=r.id AND tenant_id=p_tenant_id AND quantidade_estoque>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_complemento_insuficiente'; END IF;
    END LOOP;
  END IF;

  -- Baixa de matéria-prima (insumos) vinculados aos produtos
  IF NOT p_ignorar_estoque THEN
    FOR r IN
      SELECT pi.insumo_id, sum(pi.quantidade * qi.quantidade) as qtd_total
      FROM jsonb_array_elements(p_itens) i
      JOIN produtos p ON p.id = (i->>'produto_id')::uuid
      JOIN produto_ingredientes pi ON pi.produto_id = p.id
      JOIN LATERAL jsonb_array_elements(i->'complementos') c ON true
      JOIN complementos comp ON comp.id = (c->>'id')::uuid
      JOIN produto_ingredientes qi ON qi.produto_id = comp.id
      WHERE p.tenant_id = p_tenant_id
      GROUP BY pi.insumo_id
    LOOP
      UPDATE insumos SET quantidade_atual = quantidade_atual - r.qtd_total WHERE id = r.insumo_id AND tenant_id = p_tenant_id AND quantidade_atual >= r.qtd_total;
      IF NOT FOUND THEN RAISE EXCEPTION 'estoque_insumo_insuficiente'; END IF;
      INSERT INTO movimentacoes_estoque (insumo_id,tipo,quantidade,observacao) VALUES (r.insumo_id,'saida',r.qtd_total,'Pedido '||v_pedido.codigo);
    END LOOP;
  END IF;

  -- Marcar convite como usado
  IF p_convite_codigo IS NOT NULL THEN
    UPDATE convite_codigos SET usado_por_cliente_id=v_cliente_id,usado_em=NOW() WHERE codigo=p_convite_codigo AND tenant_id=p_tenant_id AND usado_por_cliente_id IS NULL;
  END IF;

  UPDATE idempotency_keys SET status='completed',pedido_id=v_pedido.id WHERE hash=p_idempotency_hash AND tenant_id=p_tenant_id;

  RETURN jsonb_build_object(
    'id',v_pedido.id,'codigo',v_pedido.codigo,'status',v_pedido.status,
    'valor_subtotal',v_pedido.valor_subtotal,'taxa_entrega',v_pedido.taxa_entrega,
    'valor_desconto',v_pedido.valor_desconto,'valor_total',v_pedido.valor_total,
    'tipo_entrega',v_pedido.tipo_entrega,'forma_pagamento',v_pedido.forma_pagamento
  );
END;
$$ LANGUAGE plpgsql;
