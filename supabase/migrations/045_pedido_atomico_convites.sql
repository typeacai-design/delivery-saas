-- Pedido público inteiramente transacional e convites aceitos pelo próprio usuário.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS idempotency_key_hash text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_nome text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_whatsapp text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_acesso_token_hash text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS valor_subtotal numeric DEFAULT 0;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS valor_desconto numeric DEFAULT 0;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS taxa_bairro numeric DEFAULT 0;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS troco_para numeric;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS bairro_entrega text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS endereco_entrega text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS numero_entrega text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS complemento_entrega text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_entrega text DEFAULT 'delivery';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_aplicado text;
ALTER TABLE public.pedido_itens ADD COLUMN IF NOT EXISTS variante_nome text;
ALTER TABLE public.pedido_itens ADD COLUMN IF NOT EXISTS complementos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.pedido_itens ADD COLUMN IF NOT EXISTS observacao text;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pedidos' AND column_name='forma_pagamento' AND data_type='ARRAY') THEN RAISE EXCEPTION 'pedidos.forma_pagamento deve ser TEXT[]'; END IF; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_idempotency
  ON public.pedidos(tenant_id,idempotency_key_hash) WHERE idempotency_key_hash IS NOT NULL;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mov_pedido_insumo ON public.movimentacoes_estoque(pedido_id,insumo_id) WHERE pedido_id IS NOT NULL;

-- Public orders enter exclusively through the server-side API/RPC below.
-- Dashboard access remains tenant-scoped for active store members.
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Pedidos visíveis ao tenant" ON public.pedidos;
DROP POLICY IF EXISTS "Itens visíveis ao tenant" ON public.pedido_itens;
DROP POLICY IF EXISTS "Membros gerenciam pedidos do tenant" ON public.pedidos;
DROP POLICY IF EXISTS "Membros gerenciam itens de pedidos do tenant" ON public.pedido_itens;
CREATE POLICY "Membros gerenciam pedidos do tenant" ON public.pedidos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios_loja u WHERE u.user_id=auth.uid() AND u.tenant_id=pedidos.tenant_id AND u.ativo=true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios_loja u WHERE u.user_id=auth.uid() AND u.tenant_id=pedidos.tenant_id AND u.ativo=true));
CREATE POLICY "Membros gerenciam itens de pedidos do tenant" ON public.pedido_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true));
REVOKE ALL ON TABLE public.pedidos, public.pedido_itens FROM anon;
REVOKE ALL ON TABLE public.pedidos, public.pedido_itens FROM authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.pedidos, public.pedido_itens TO authenticated;

CREATE TABLE IF NOT EXISTS public.convites_loja (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 email text NOT NULL, nome text NOT NULL, role text NOT NULL CHECK(role IN ('kitchen','motoboy')),
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.convites_loja ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.convites_loja FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.aceitar_convite_loja(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v convites_loja%rowtype; v_email text; v_member usuarios_loja%rowtype;
BEGIN
 v_email=lower(coalesce(auth.jwt()->>'email',''));
 IF auth.uid() IS NULL OR v_email='' THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
 SELECT * INTO v FROM convites_loja WHERE token_hash=p_token_hash AND accepted_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR lower(v.email)<>v_email THEN RAISE EXCEPTION 'convite_invalido'; END IF;
 INSERT INTO usuarios_loja(tenant_id,user_id,nome,email,role,ativo) VALUES(v.tenant_id,auth.uid(),v.nome,v_email,v.role,true)
 ON CONFLICT(tenant_id,user_id) DO UPDATE SET nome=excluded.nome,email=excluded.email,role=excluded.role,ativo=true RETURNING * INTO v_member;
 UPDATE convites_loja SET accepted_at=now() WHERE id=v.id;
 RETURN jsonb_build_object('tenant_id',v_member.tenant_id,'role',v_member.role);
END $$;
REVOKE ALL ON FUNCTION public.aceitar_convite_loja(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.aceitar_convite_loja(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_pedido_atomico(p_tenant_id uuid,p_token_hash text,p_idempotency_hash text,p_cliente jsonb,p_pedido jsonb,p_itens jsonb)
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

 FOR r IN SELECT p.id,sum((i->>'quantidade')::int) qtd FROM jsonb_array_elements(p_itens)i JOIN produtos p ON p.id=(i->>'produto_id')::uuid WHERE p.tenant_id=p_tenant_id AND p.controlar_estoque GROUP BY p.id LOOP
  UPDATE produtos SET quantidade_estoque=quantidade_estoque-r.qtd WHERE id=r.id AND tenant_id=p_tenant_id AND quantidade_estoque>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_produto_insuficiente'; END IF;
 END LOOP;
 FOR r IN SELECT c.id,sum((x->>'quantidade')::numeric*(i->>'quantidade')::numeric) qtd FROM jsonb_array_elements(p_itens)i CROSS JOIN LATERAL jsonb_array_elements(coalesce(i->'complementos','[]'))x JOIN complementos c ON c.id=(x->>'id')::uuid WHERE c.tenant_id=p_tenant_id AND c.controlar_estoque GROUP BY c.id LOOP
  UPDATE complementos SET quantidade_estoque=quantidade_estoque-r.qtd WHERE id=r.id AND tenant_id=p_tenant_id AND quantidade_estoque>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_complemento_insuficiente'; END IF;
 END LOOP;
 FOR r IN SELECT pi.insumo_id,sum(pi.quantidade*(i->>'quantidade')::numeric) qtd FROM jsonb_array_elements(p_itens)i JOIN produto_ingredientes pi ON pi.produto_id=(i->>'produto_id')::uuid AND pi.tenant_id=p_tenant_id GROUP BY pi.insumo_id LOOP
  UPDATE insumos SET quantidade_atual=quantidade_atual-r.qtd WHERE id=r.insumo_id AND tenant_id=p_tenant_id AND quantidade_atual>=r.qtd; IF NOT FOUND THEN RAISE EXCEPTION 'estoque_insumo_insuficiente'; END IF;
  INSERT INTO movimentacoes_estoque(insumo_id,tipo,quantidade,observacao,pedido_id) VALUES(r.insumo_id,'saida',r.qtd,'Baixa automática do pedido',v_pedido.id);
 END LOOP;
 RETURN to_jsonb(v_pedido);
EXCEPTION WHEN unique_violation THEN SELECT * INTO v_pedido FROM pedidos WHERE tenant_id=p_tenant_id AND idempotency_key_hash=p_idempotency_hash; IF FOUND THEN RETURN to_jsonb(v_pedido); ELSE RAISE; END IF;
END $$;
REVOKE ALL ON FUNCTION public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb) TO service_role;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('pedidos','pedido_itens') AND roles @> ARRAY['anon'::name]) THEN
  RAISE EXCEPTION 'Migration 045: tabela de pedidos ainda possui policy para anon';
 END IF;
 IF has_table_privilege('anon','public.pedidos','SELECT') OR has_table_privilege('anon','public.pedidos','INSERT') OR
    has_table_privilege('anon','public.pedidos','UPDATE') OR has_table_privilege('anon','public.pedidos','DELETE') THEN
  RAISE EXCEPTION 'Migration 045: anon ainda possui privilegios em pedidos';
 END IF;
 IF has_table_privilege('anon','public.pedido_itens','SELECT') OR has_table_privilege('anon','public.pedido_itens','INSERT') OR
    has_table_privilege('anon','public.pedido_itens','UPDATE') OR has_table_privilege('anon','public.pedido_itens','DELETE') THEN
  RAISE EXCEPTION 'Migration 045: anon ainda possui privilegios em pedido_itens';
 END IF;
END $$;
