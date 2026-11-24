-- QR Code por mesa + aceite automático de pedidos.
-- 1) mesas.qr_token: código secreto e fixo do QR (não muda se a mesa mudar de número).
-- 2) Número de mesa único por loja e uma única comanda aberta por mesa (evita comanda duplicada
--    quando duas pessoas pedem ao mesmo tempo pelo QR).
-- 3) Pedido de mesa pelo QR pode vir sem WhatsApp: criar_pedido_atomico reaproveita o cliente do
--    aparelho pelo token; sem telefone e sem cadastro anterior, o pedido fica só com o nome (sem cadastro).
-- 4) Aceite automático: com tenants.config.aceitar_pedidos_automaticamente = true, pedidos novos
--    entram direto em 'preparando'.

ALTER TABLE public.mesas ADD COLUMN IF NOT EXISTS qr_token text;
UPDATE public.mesas SET qr_token = replace(gen_random_uuid()::text, '-', '') WHERE qr_token IS NULL;
ALTER TABLE public.mesas ALTER COLUMN qr_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');
ALTER TABLE public.mesas ALTER COLUMN qr_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mesas_qr_token_key ON public.mesas (qr_token);
CREATE UNIQUE INDEX IF NOT EXISTS mesas_tenant_numero_key ON public.mesas (tenant_id, numero);
CREATE UNIQUE INDEX IF NOT EXISTS sessoes_mesa_uma_aberta_por_mesa ON public.sessoes_mesa (tenant_id, mesa_numero) WHERE status = 'aberta';

CREATE OR REPLACE FUNCTION public.pedido_aceite_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'novo' AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = NEW.tenant_id AND COALESCE((t.config->>'aceitar_pedidos_automaticamente')::boolean, false)
  ) THEN
    NEW.status := 'preparando';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_aceite_automatico ON public.pedidos;
CREATE TRIGGER trg_pedido_aceite_automatico
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.pedido_aceite_automatico();

CREATE OR REPLACE FUNCTION public.criar_pedido_atomico(p_tenant_id uuid, p_token_hash text, p_idempotency_hash text, p_cliente jsonb, p_pedido jsonb, p_itens jsonb, p_ignorar_estoque boolean DEFAULT false, p_convite_codigo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'America/Sao_Paulo'
AS $function$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_cliente_id UUID;
  v_cupom cupons%ROWTYPE;
  r RECORD;
  v_cashback_solicitado numeric(12,2) := 0;
  v_cashback_restante numeric(12,2) := 0;
  v_cashback_parcela numeric(12,2) := 0;
  v_cashback_credito record;
  v_cashback_usos jsonb := '[]'::jsonb;
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
  -- Mesa (QR) sem WhatsApp: reaproveita o cliente deste aparelho pelo token, sem duplicar.
  IF NULLIF(btrim(coalesce(p_cliente->>'telefone','')),'') IS NULL THEN
    SELECT c.id INTO v_cliente_id FROM clientes c
    WHERE c.tenant_id=p_tenant_id AND c.acesso_token_hash=p_token_hash AND c.ativo=true
    ORDER BY c.created_at ASC LIMIT 1;
  ELSE
    v_cliente_id := public.buscar_ou_unificar_cliente(
      p_tenant_id,
      p_cliente->>'telefone',
      p_token_hash
    );
  END IF;
  IF v_cliente_id IS NOT NULL THEN
    UPDATE clientes SET
      nome=COALESCE(NULLIF(p_cliente->>'nome',''),nome),
      telefone=COALESCE(NULLIF(p_cliente->>'telefone',''),telefone),
      endereco=COALESCE(NULLIF(p_cliente->>'endereco',''),endereco),
      total_pedidos=COALESCE(total_pedidos,0)+1,
      ultimo_pedido_em=now()
    WHERE id=v_cliente_id AND tenant_id=p_tenant_id;
  ELSIF NULLIF(btrim(coalesce(p_cliente->>'telefone','')),'') IS NOT NULL THEN
    -- Cria novo registro (pedido de mesa sem WhatsApp fica só com o nome no pedido, sem cadastro)
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


  -- Consumo transacional: bloqueia a conta do cliente, expira créditos antigos
  -- e impede uso simultâneo do mesmo saldo em dois pedidos.
  v_cashback_solicitado:=coalesce((p_pedido->>'cashback_usado')::numeric,0);
  if v_cashback_solicitado<0 or v_cashback_solicitado>coalesce((p_pedido->>'valor_desconto')::numeric,0)
    or v_cashback_solicitado>coalesce((p_pedido->>'valor_subtotal')::numeric,0)+coalesce((p_pedido->>'taxa_entrega')::numeric,0)
    or v_cashback_solicitado<>round(v_cashback_solicitado,2)
    then raise exception 'cashback_invalido'; end if;
  if v_cashback_solicitado>0 then
    perform 1 from clientes where id=v_cliente_id and tenant_id=p_tenant_id for update;
    if not exists(select 1 from tenants where id=p_tenant_id and (config->>'cashback_ativo')::boolean=true)
      then raise exception 'cashback_desativado'; end if;
    v_cashback_restante:=v_cashback_solicitado;
    for v_cashback_credito in
      select id,valor_restante from cashback_creditos
      where tenant_id=p_tenant_id and cliente_id=v_cliente_id and valor_restante>0
        and (expira_em is null or expira_em>now())
      order by expira_em asc nulls last,criado_em asc,id asc for update
    loop
      exit when v_cashback_restante<=0;
      v_cashback_parcela:=least(v_cashback_restante,v_cashback_credito.valor_restante);
      update cashback_creditos set valor_restante=valor_restante-v_cashback_parcela where id=v_cashback_credito.id;
      v_cashback_usos:=v_cashback_usos||jsonb_build_array(jsonb_build_object('credito_id',v_cashback_credito.id,'valor',v_cashback_parcela));
      v_cashback_restante:=v_cashback_restante-v_cashback_parcela;
    end loop;
    if v_cashback_restante>0 then raise exception 'cashback_insuficiente'; end if;
    update clientes set saldo_cashback=greatest(0,coalesce(saldo_cashback,0)-v_cashback_solicitado) where id=v_cliente_id and tenant_id=p_tenant_id;
  end if;

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


  if v_cashback_solicitado>0 then
    insert into cashback_utilizacoes(tenant_id,cliente_id,pedido_id,credito_id,valor)
    select p_tenant_id,v_cliente_id,v_pedido.id,(x->>'credito_id')::uuid,(x->>'valor')::numeric
    from jsonb_array_elements(v_cashback_usos) x;
  end if;

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
$function$;
