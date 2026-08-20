-- Corrige criar_pedido_atomico para:
-- 1. Só baixar estoque de insumos SE o produto tiver controlar_estoque = true
-- 2. Permite parametro opcional p_ignorar_estoque para pular toda verificacao de estoque

CREATE OR REPLACE FUNCTION public.criar_pedido_atomico(
  p_tenant_id uuid,
  p_token_hash text,
  p_idempotency_hash text,
  p_cliente jsonb,
  p_pedido jsonb,
  p_itens jsonb,
  p_ignorar_estoque boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cliente uuid; v_pedido pedidos%rowtype; v_cupom cupons%rowtype; r record;
BEGIN
 SELECT * INTO v_pedido FROM pedidos WHERE tenant_id=p_tenant_id AND idempotency_key_hash=p_idempotency_hash;
 IF FOUND THEN RETURN to_jsonb(v_pedido); END IF;

 SELECT id INTO v_cliente FROM clientes WHERE tenant_id=p_tenant_id AND acesso_token_hash=p_token_hash FOR UPDATE;
 IF v_cliente IS NULL THEN
  INSERT INTO clientes(tenant_id,nome,telefone,endereco,data_nascimento,cpf,acesso_token_hash,total_pedidos,ultimo_pedido_em)
  VALUES(p_tenant_id,p_cliente->>'nome',p_cliente->>'telefone',nullif(p_cliente->>'endereco',''),nullif(p_cliente->>'data_nascimento','')::date,nullif(p_cliente->>'cpf',''),p_token_hash,1,now()) RETURNING id INTO v_cliente;
 ELSE
  UPDATE clientes SET nome=p_cliente->>'nome',telefone=p_cliente->>'telefone',endereco=nullif(p_cliente->>'endereco',''),data_nascimento=nullif(p_cliente->>'data_nascimento','')::date,cpf=nullif(p_cliente->>'cpf',''),total_pedidos=coalesce(total_pedidos,0)+1,ultimo_pedido_em=now() WHERE id=v_cliente AND tenant_id=p_tenant_id;
 END IF;

 INSERT INTO pedidos(tenant_id,cliente_id,cliente_nome,cliente_whatsapp,cliente_acesso_token_hash,valor_subtotal,taxa_entrega,valor_desconto,valor_total,forma_pagamento,troco_para,bairro_entrega,taxa_bairro,endereco_entrega,numero_entrega,complemento_entrega,tipo_entrega,observacoes,status,cupom_aplicado,idempotency_key_hash)
 VALUES(p_tenant_id,v_cliente,p_cliente->>'nome',p_cliente->>'telefone',p_token_hash,(p_pedido->>'valor_subtotal')::numeric,(p_pedido->>'taxa_entrega')::numeric,(p_pedido->>'valor_desconto')::numeric,(p_pedido->>'valor_total')::numeric,ARRAY[p_pedido->>'forma_pagamento']::text[],nullif(p_pedido->>'troco_para','')::numeric,nullif(p_pedido->>'bairro_entrega',''),(p_pedido->>'taxa_entrega')::numeric,nullif(p_pedido->>'endereco_entrega',''),nullif(p_pedido->>'numero_entrega',''),nullif(p_pedido->>'complemento_entrega',''),p_pedido->>'tipo_entrega',nullif(p_pedido->>'observacoes',''),'novo',nullif(p_pedido->>'cupom_aplicado',''),p_idempotency_hash) RETURNING * INTO v_pedido;

 IF nullif(p_pedido->>'cupom_aplicado','') IS NOT NULL THEN
  SELECT * INTO v_cupom FROM cupons WHERE tenant_id=p_tenant_id AND codigo=p_pedido->>'cupom_aplicado' AND ativo=true FOR UPDATE;
  IF NOT FOUND OR (v_cupom.validade IS NOT NULL AND v_cupom.validade<current_date) OR (v_cupom.max_usos IS NOT NULL AND coalesce(v_cupom.usos_atuais,0)>=v_cupom.max_usos) THEN RAISE EXCEPTION 'cupom_indisponivel'; END IF;
  UPDATE cupons SET usos_atuais=coalesce(usos_atuais,0)+1 WHERE id=v_cupom.id;
 END IF;

 INSERT INTO pedido_itens(pedido_id,produto_id,nome,quantidade,valor_unitario,variante_id,variante_nome,complementos,observacao)
 SELECT v_pedido.id,(i->>'produto_id')::uuid,i->>'nome',(i->>'quantidade')::int,(i->>'valor_unitario')::numeric,nullif(i->>'variante_id','')::uuid,nullif(i->>'variante_nome',''),coalesce(i->'complementos','[]'),nullif(i->>'observacao','') FROM jsonb_array_elements(p_itens)i;

 -- Baixa estoque de produtos SOMENTE se controlar_estoque = true e nao estiver ignorando
 IF NOT p_ignorar_estoque THEN
   FOR r IN SELECT p.id,sum((i->>'quantidade')::int) qtd FROM jsonb_array_elements(p_itens)i JOIN produtos p ON p.id=(i->>'produto_id')::uuid WHERE p.tenant_id=p_tenant_id AND p.controlar_estoque=true GROUP BY p.id LOOP
    UPDATE produtos SET quantidade_estoque=quantidade_estoque-r.qtd WHERE id=r.id AND tenant_id=p_tenant_id AND quantidade_estoque>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_produto_insuficiente'; END IF;
   END LOOP;

   FOR r IN SELECT c.id,sum((x->>'quantidade')::numeric*(i->>'quantidade')::numeric) qtd FROM jsonb_array_elements(p_itens)i CROSS JOIN LATERAL jsonb_array_elements(coalesce(i->'complementos','[]'))x JOIN complementos c ON c.id=(x->>'id')::uuid WHERE c.tenant_id=p_tenant_id AND c.controlar_estoque=true GROUP BY c.id LOOP
    UPDATE complementos SET quantidade_estoque=quantidade_estoque-r.qtd WHERE id=r.id AND tenant_id=p_tenant_id AND quantidade_estoque>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_complemento_insuficiente'; END IF;
   END LOOP;

   -- Baixa estoque de insumos SOMENTE se o produto tiver controlar_estoque = true
   FOR r IN SELECT pi.insumo_id,sum(pi.quantidade*(i->>'quantidade')::numeric) qtd
     FROM jsonb_array_elements(p_itens)i
     JOIN produtos p ON p.id=(i->>'produto_id')::uuid AND p.tenant_id=p_tenant_id AND p.controlar_estoque=true
     JOIN produto_ingredientes pi ON pi.produto_id=p.id AND pi.tenant_id=p_tenant_id
     GROUP BY pi.insumo_id LOOP
    UPDATE insumos SET quantidade_atual=quantidade_atual-r.qtd WHERE id=r.insumo_id AND tenant_id=p_tenant_id AND quantidade_atual>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_insumo_insuficiente'; END IF;
    INSERT INTO movimentacoes_estoque(insumo_id,tipo,quantidade,observacao,pedido_id) VALUES(r.insumo_id,'saida',r.qtd,'Baixa automática do pedido',v_pedido.id);
   END LOOP;
 END IF;

 RETURN to_jsonb(v_pedido);
EXCEPTION WHEN unique_violation THEN SELECT * INTO v_pedido FROM pedidos WHERE tenant_id=p_tenant_id AND idempotency_key_hash=p_idempotency_hash; IF FOUND THEN RETURN to_jsonb(v_pedido); ELSE RAISE; END IF;
END $$;
