-- Persistir forma selecionada no checkout público e retornar troco.
CREATE OR REPLACE FUNCTION public.criar_pedido_atomico(p_tenant_id uuid, p_token_hash text, p_idempotency_hash text, p_cliente jsonb, p_pedido jsonb, p_itens jsonb, p_ignorar_estoque boolean DEFAULT false, p_convite_codigo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_cliente_id UUID;
  v_cupom cupons%ROWTYPE;
  r RECORD;
BEGIN
  -- 1) Idempotencia: se ja existe pedido com mesmo hash, retorna ele
  SELECT * INTO v_pedido FROM pedidos
  WHERE tenant_id=p_tenant_id AND idempotency_key_hash=p_idempotency_hash
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id',v_pedido.id,'codigo',v_pedido.codigo,'status',v_pedido.status,
      'valor_subtotal',v_pedido.valor_subtotal,'taxa_entrega',v_pedido.taxa_entrega,
      'valor_desconto',v_pedido.valor_desconto,'valor_total',v_pedido.valor_total,
      'tipo_entrega',v_pedido.tipo_entrega,'forma_pagamento',v_pedido.forma_pagamento,'troco_para',v_pedido.troco_para
    );
  END IF;

  -- 2) Encontrar ou criar cliente
  -- Primeiro tenta unificar por telefone (migration 067): se ja existe
  -- OUTRO cliente com mesmo (tenant, telefone), reaproveita ele e move
  -- o token. Isso evita duplicacao entre dispositivos.
  v_cliente_id := public.buscar_ou_unificar_cliente(
    p_tenant_id,
    p_cliente->>'telefone',
    p_token_hash
  );
  IF v_cliente_id IS NOT NULL THEN
    UPDATE clientes SET
      nome=COALESCE(NULLIF(p_cliente->>'nome',''),nome),
      telefone=COALESCE(NULLIF(p_cliente->>'telefone',''),telefone),
      endereco=COALESCE(NULLIF(p_cliente->>'endereco',''),endereco),
      total_pedidos=COALESCE(total_pedidos,0)+1,
      ultimo_pedido_em=now()
    WHERE id=v_cliente_id AND tenant_id=p_tenant_id;
  ELSE
    -- Cria novo registro
    INSERT INTO clientes(id,tenant_id,nome,telefone,endereco,data_nascimento,cpf,acesso_token_hash,total_pedidos,ultimo_pedido_em)
    VALUES(gen_random_uuid(),p_tenant_id,
           p_cliente->>'nome',p_cliente->>'telefone',
           NULLIF(p_cliente->>'endereco',''),
           NULLIF(p_cliente->>'data_nascimento','')::date,
           NULLIF(p_cliente->>'cpf',''),
           p_token_hash,1,now())
    RETURNING id INTO v_cliente_id;
  END IF;

  -- 3) Validar e consumir cupom
  IF NULLIF(p_pedido->>'cupom_aplicado','') IS NOT NULL THEN
    SELECT * INTO v_cupom FROM cupons
    WHERE tenant_id=p_tenant_id AND codigo=p_pedido->>'cupom_aplicado' AND ativo=true
    FOR UPDATE;
    IF NOT FOUND
       OR (v_cupom.validade IS NOT NULL AND v_cupom.validade < current_date)
       OR (v_cupom.max_usos IS NOT NULL AND COALESCE(v_cupom.usos_atuais,0) >= v_cupom.max_usos) THEN
      RAISE EXCEPTION 'cupom_indisponivel';
    END IF;
    UPDATE cupons SET usos_atuais=COALESCE(usos_atuais,0)+1 WHERE id=v_cupom.id;
  END IF;

  -- 4) Inserir pedido
  INSERT INTO pedidos(
    tenant_id,cliente_id,cliente_nome,cliente_whatsapp,cliente_acesso_token_hash,
    valor_subtotal,taxa_entrega,valor_desconto,valor_total,
    forma_pagamento,troco_para,
    bairro_entrega,taxa_bairro,endereco_entrega,numero_entrega,complemento_entrega,
    tipo_entrega,observacoes,cupom_aplicado,status,idempotency_key_hash
  ) VALUES (
    p_tenant_id, v_cliente_id,
    p_cliente->>'nome', p_cliente->>'telefone', p_token_hash,
    COALESCE((p_pedido->>'valor_subtotal')::numeric, 0),
    COALESCE((p_pedido->>'taxa_entrega')::numeric, 0),
    COALESCE((p_pedido->>'valor_desconto')::numeric, 0),
    COALESCE((p_pedido->>'valor_total')::numeric, 0),
    CASE
      WHEN jsonb_typeof(p_pedido->'formas_pagamento') = 'array'
       AND jsonb_array_length(p_pedido->'formas_pagamento') = 1 THEN
        ARRAY[p_pedido->'formas_pagamento'->0->>'forma']::text[]
      WHEN p_pedido->>'forma_pagamento' IS NOT NULL
       AND p_pedido->>'forma_pagamento' <> '' THEN
        ARRAY[p_pedido->>'forma_pagamento']::text[]
      ELSE ARRAY[]::text[]
    END,
    NULLIF(p_pedido->>'troco_para','')::numeric,
    NULLIF(p_pedido->>'bairro_entrega',''),
    COALESCE((p_pedido->>'taxa_entrega')::numeric, 0),
    NULLIF(p_pedido->>'endereco_entrega',''),
    NULLIF(p_pedido->>'numero_entrega',''),
    NULLIF(p_pedido->>'complemento_entrega',''),
    COALESCE(NULLIF(p_pedido->>'tipo_entrega',''),'delivery'),
    NULLIF(p_pedido->>'observacoes',''),
    NULLIF(p_pedido->>'cupom_aplicado',''),
    'novo',
    p_idempotency_hash
  )
  RETURNING * INTO v_pedido;

  -- 5) Inserir itens
  INSERT INTO pedido_itens(pedido_id,produto_id,nome,quantidade,valor_unitario,variante_id,variante_nome,complementos,observacao)
  SELECT
    v_pedido.id,
    (i->>'produto_id')::uuid,
    i->>'nome',
    (i->>'quantidade')::int,
    (i->>'valor_unitario')::numeric,
    NULLIF(i->>'variante_id','')::uuid,
    NULLIF(i->>'variante_nome',''),
    COALESCE(i->'complementos','[]'::jsonb),
    NULLIF(i->>'observacao','')
  FROM jsonb_array_elements(p_itens) i;

  -- 6) Baixa de estoque de produtos
  IF NOT p_ignorar_estoque THEN
    FOR r IN
      SELECT p.id, SUM((i->>'quantidade')::int) qtd
      FROM jsonb_array_elements(p_itens) i
      JOIN produtos p ON p.id=(i->>'produto_id')::uuid
      WHERE p.tenant_id=p_tenant_id AND p.controlar_estoque=true
      GROUP BY p.id
    LOOP
      UPDATE produtos
      SET quantidade_estoque=quantidade_estoque-r.qtd
      WHERE id=r.id AND tenant_id=p_tenant_id AND quantidade_estoque>=r.qtd;
      IF NOT FOUND THEN RAISE EXCEPTION 'estoque_produto_insuficiente'; END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id',v_pedido.id,'codigo',v_pedido.codigo,'status',v_pedido.status,
    'valor_subtotal',v_pedido.valor_subtotal,'taxa_entrega',v_pedido.taxa_entrega,
    'valor_desconto',v_pedido.valor_desconto,'valor_total',v_pedido.valor_total,
    'tipo_entrega',v_pedido.tipo_entrega,'forma_pagamento',v_pedido.forma_pagamento,'troco_para',v_pedido.troco_para
  );

EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_pedido FROM pedidos
  WHERE tenant_id=p_tenant_id AND idempotency_key_hash=p_idempotency_hash;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id',v_pedido.id,'codigo',v_pedido.codigo,'status',v_pedido.status,
      'valor_subtotal',v_pedido.valor_subtotal,'taxa_entrega',v_pedido.taxa_entrega,
      'valor_desconto',v_pedido.valor_desconto,'valor_total',v_pedido.valor_total,
      'tipo_entrega',v_pedido.tipo_entrega,'forma_pagamento',v_pedido.forma_pagamento,'troco_para',v_pedido.troco_para
    );
  ELSE
    RAISE;
  END IF;
END;
$function$
;
