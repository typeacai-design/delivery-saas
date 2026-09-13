-- Additive, opt-in configuration. No existing product/order is converted.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sabores_ativo boolean NOT NULL DEFAULT false;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS sabores_grupo_id uuid REFERENCES public.categorias_complementos(id) ON DELETE RESTRICT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS sabores_maximo smallint NOT NULL DEFAULT 2 CHECK (sabores_maximo IN (2,3));

CREATE OR REPLACE FUNCTION public.validar_configuracao_sabores() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'tenants' THEN
    IF NEW.sabores_ativo IS DISTINCT FROM OLD.sabores_ativo AND auth.role() IS DISTINCT FROM 'service_role'
      AND NOT EXISTS (SELECT 1 FROM usuarios_loja WHERE user_id=auth.uid() AND tenant_id=NEW.id AND ativo AND role IN ('owner','manager')) THEN
      RAISE EXCEPTION 'Somente proprietario ou gerente pode configurar sabores';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.sabores_grupo_id IS NULL AND (TG_OP = 'INSERT' OR OLD.sabores_grupo_id IS NULL) THEN RETURN NEW; END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND NOT EXISTS (SELECT 1 FROM usuarios_loja WHERE user_id=auth.uid() AND tenant_id=NEW.tenant_id AND ativo AND role IN ('owner','manager')) THEN
    RAISE EXCEPTION 'Somente proprietario ou gerente pode configurar sabores';
  END IF;
  IF NEW.sabores_grupo_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM categorias_complementos WHERE id=NEW.sabores_grupo_id AND tenant_id=NEW.tenant_id AND ativo) THEN
    RAISE EXCEPTION 'Escolha uma lista de sabores ativa desta loja';
  END IF;
  IF EXISTS (SELECT 1 FROM complementos WHERE categoria_id=NEW.sabores_grupo_id AND tenant_id=NEW.tenant_id AND ativo AND controlar_estoque) THEN
    RAISE EXCEPTION 'A lista de sabores nao pode ter controle de estoque. Revise os complementos';
  END IF;
  IF (SELECT count(*) FROM complementos WHERE categoria_id=NEW.sabores_grupo_id AND tenant_id=NEW.tenant_id AND ativo) < NEW.sabores_maximo THEN
    RAISE EXCEPTION 'A lista precisa ter sabores ativos suficientes para o limite escolhido';
  END IF;
  IF EXISTS (SELECT 1 FROM variantes WHERE produto_id=NEW.id) THEN
    RAISE EXCEPTION 'Use um produto por tamanho: sabores nao aceitam variacoes';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_sabores_tenant ON public.tenants;
CREATE TRIGGER validar_sabores_tenant BEFORE UPDATE OF sabores_ativo ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.validar_configuracao_sabores();
DROP TRIGGER IF EXISTS validar_sabores_produto ON public.produtos;
CREATE TRIGGER validar_sabores_produto BEFORE INSERT OR UPDATE OF sabores_grupo_id,sabores_maximo,tenant_id ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.validar_configuracao_sabores();

-- New columns must be readable by catalog clients; writes still require existing RLS and trigger checks.
GRANT SELECT (sabores_ativo) ON public.tenants TO anon, authenticated;
GRANT UPDATE (sabores_ativo) ON public.tenants TO authenticated;
GRANT SELECT (sabores_grupo_id,sabores_maximo) ON public.produtos TO anon, authenticated;
GRANT UPDATE (sabores_grupo_id,sabores_maximo), INSERT (sabores_grupo_id,sabores_maximo) ON public.produtos TO authenticated;

-- Separate transaction for edits; intentionally does not replace criar_pedido_atomico.
CREATE OR REPLACE FUNCTION public.editar_pedido_sabores_atomico(p_tenant_id uuid,p_pedido_id uuid,p_updates jsonb,p_itens jsonb,p_versao timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_order pedidos%ROWTYPE; patched pedidos%ROWTYPE;
BEGIN
  SELECT * INTO current_order FROM pedidos WHERE id=p_pedido_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado'; END IF;
  IF current_order.data_atualizacao IS DISTINCT FROM p_versao THEN RAISE EXCEPTION 'Pedido alterado por outro usuario. Atualize antes de salvar'; END IF;
  patched := jsonb_populate_record(current_order,p_updates);
  IF p_itens IS NOT NULL THEN
    IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens)=0 THEN RAISE EXCEPTION 'Pedido sem itens'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_itens) i WHERE (i->>'quantidade')::numeric < 1 OR (i->>'quantidade')::numeric <> trunc((i->>'quantidade')::numeric)) THEN RAISE EXCEPTION 'Quantidade invalida'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_itens) i LEFT JOIN produtos p ON p.id=(i->>'produto_id')::uuid AND p.tenant_id=p_tenant_id WHERE i->>'produto_id' IS NOT NULL AND p.id IS NULL) THEN RAISE EXCEPTION 'Produto de outra loja'; END IF;
    DELETE FROM pedido_itens WHERE pedido_id=p_pedido_id;
    INSERT INTO pedido_itens(pedido_id,produto_id,nome,quantidade,valor_unitario,variante_id,variante_nome,complementos,observacao,pontos)
    SELECT p_pedido_id,NULLIF(i->>'produto_id','')::uuid,i->>'nome',(i->>'quantidade')::int,(i->>'valor_unitario')::numeric,
      NULLIF(i->>'variante_id','')::uuid,NULLIF(i->>'variante_nome',''),COALESCE(i->'complementos','[]'::jsonb),NULLIF(i->>'observacao',''),COALESCE((i->>'pontos')::int,0)
    FROM jsonb_array_elements(p_itens) i;
  END IF;
  UPDATE pedidos SET cliente_nome=patched.cliente_nome,cliente_whatsapp=patched.cliente_whatsapp,
    endereco_entrega=patched.endereco_entrega,numero_entrega=patched.numero_entrega,complemento_entrega=patched.complemento_entrega,
    bairro_entrega=patched.bairro_entrega,observacoes=patched.observacoes,taxa_entrega=patched.taxa_entrega,
    valor_desconto=patched.valor_desconto,valor_subtotal=patched.valor_subtotal,valor_total=patched.valor_total,data_atualizacao=now()
  WHERE id=p_pedido_id AND tenant_id=p_tenant_id RETURNING * INTO patched;
  RETURN to_jsonb(patched);
END $$;
REVOKE ALL ON FUNCTION public.editar_pedido_sabores_atomico(uuid,uuid,jsonb,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.editar_pedido_sabores_atomico(uuid,uuid,jsonb,jsonb,timestamptz) TO service_role;
NOTIFY pgrst, 'reload schema';

-- Manual order and its items are committed together; service-only after API authorization/validation.
CREATE OR REPLACE FUNCTION public.criar_pedido_manual_atomico(p_tenant_id uuid,p_pedido jsonb,p_itens jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created pedidos%ROWTYPE; columns_sql text; values_sql text;
BEGIN
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens)=0 THEN RAISE EXCEPTION 'Pedido sem itens'; END IF;
  IF NULLIF(p_pedido->>'cliente_id','') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id=(p_pedido->>'cliente_id')::uuid AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Cliente de outra loja'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_itens) i LEFT JOIN produtos p ON p.id=(i->>'produto_id')::uuid AND p.tenant_id=p_tenant_id WHERE p.id IS NULL) THEN RAISE EXCEPTION 'Produto de outra loja'; END IF;
  p_pedido := p_pedido || jsonb_build_object('tenant_id',p_tenant_id);
  SELECT string_agg(format('%I',key),',' ORDER BY key), string_agg(format('(jsonb_populate_record(NULL::public.pedidos,$1)).%I',key),',' ORDER BY key)
  INTO columns_sql,values_sql FROM jsonb_object_keys(p_pedido) key;
  EXECUTE format('INSERT INTO public.pedidos(%s) SELECT %s RETURNING *',columns_sql,values_sql) INTO created USING p_pedido;
  INSERT INTO pedido_itens(pedido_id,produto_id,nome,quantidade,valor_unitario,variante_id,variante_nome,complementos,observacao,pontos)
  SELECT created.id,(i->>'produto_id')::uuid,i->>'nome',(i->>'quantidade')::int,(i->>'valor_unitario')::numeric,
    NULLIF(i->>'variante_id','')::uuid,NULLIF(i->>'variante_nome',''),COALESCE(i->'complementos','[]'::jsonb),NULLIF(i->>'observacao',''),COALESCE((i->>'pontos')::int,0)
  FROM jsonb_array_elements(p_itens) i;
  RETURN to_jsonb(created);
END $$;
REVOKE ALL ON FUNCTION public.criar_pedido_manual_atomico(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_manual_atomico(uuid,jsonb,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';

-- Prevent later edits from silently invalidating an opted-in product.
CREATE OR REPLACE FUNCTION public.proteger_catalogo_sabores() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME='variantes' THEN
    IF EXISTS (SELECT 1 FROM produtos WHERE id=NEW.produto_id AND sabores_grupo_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Use um produto por tamanho: sabores nao aceitam variacoes';
    END IF;
  ELSIF TG_TABLE_NAME='complementos' THEN
    IF NEW.ativo AND NEW.controlar_estoque AND EXISTS (SELECT 1 FROM produtos WHERE sabores_grupo_id=NEW.categoria_id) THEN
      RAISE EXCEPTION 'Este complemento e usado como sabor. Nao e possivel ativar controle de estoque fracionado';
    END IF;
  ELSE
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND EXISTS (SELECT 1 FROM produtos WHERE sabores_grupo_id=OLD.id) THEN
      RAISE EXCEPTION 'Lista de sabores vinculada nao pode mudar de loja';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_variantes_sabores ON public.variantes;
CREATE TRIGGER proteger_variantes_sabores BEFORE INSERT OR UPDATE OF produto_id ON public.variantes FOR EACH ROW EXECUTE FUNCTION public.proteger_catalogo_sabores();
DROP TRIGGER IF EXISTS proteger_estoque_sabores ON public.complementos;
CREATE TRIGGER proteger_estoque_sabores BEFORE INSERT OR UPDATE OF controlar_estoque,categoria_id,ativo ON public.complementos FOR EACH ROW EXECUTE FUNCTION public.proteger_catalogo_sabores();
DROP TRIGGER IF EXISTS proteger_lista_sabores ON public.categorias_complementos;
CREATE TRIGGER proteger_lista_sabores BEFORE UPDATE OF tenant_id ON public.categorias_complementos FOR EACH ROW EXECUTE FUNCTION public.proteger_catalogo_sabores();

-- Every current public checkout calls this RPC through the validated service API.
-- Prevent direct anonymous/authenticated RPC calls from bypassing authoritative prices.
REVOKE ALL ON FUNCTION public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb,boolean,text) TO service_role;
