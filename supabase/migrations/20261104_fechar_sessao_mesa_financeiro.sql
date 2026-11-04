-- Fechamento atomico da comanda, acessivel somente ao backend service_role.
CREATE OR REPLACE FUNCTION public.fechar_sessao_mesa_financeiro(
  p_tenant_id uuid, p_sessao_id uuid, p_forma_pagamento text, p_valor_entregue numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sessao public.sessoes_mesa%ROWTYPE;
  v_pedido public.pedidos%ROWTYPE;
  v_total numeric := 0;
  v_pago numeric := 0;
  v_qtd integer := 0;
  v_troco numeric := 0;
BEGIN
  IF p_forma_pagamento NOT IN ('dinheiro','pix','cartao_credito','cartao_debito') THEN
    RAISE EXCEPTION 'Forma de pagamento invalida';
  END IF;
  SELECT * INTO v_sessao FROM public.sessoes_mesa
  WHERE id=p_sessao_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mesa nao encontrada'; END IF;
  IF v_sessao.status <> 'aberta' THEN RAISE EXCEPTION 'Mesa ja encerrada'; END IF;
  SELECT COALESCE(SUM(valor_total),0),COUNT(*) INTO v_total,v_qtd
  FROM public.pedidos WHERE sessao_mesa_id=p_sessao_id AND tenant_id=p_tenant_id AND status <> 'cancelado';
  IF v_qtd=0 THEN RAISE EXCEPTION 'Mesa sem consumo; cancele a sessao em vez de cobrar'; END IF;
  IF EXISTS (SELECT 1 FROM public.pedidos WHERE sessao_mesa_id=p_sessao_id AND tenant_id=p_tenant_id AND status <> 'cancelado' AND pago IS TRUE)
  THEN RAISE EXCEPTION 'Existe pedido ja pago nesta mesa; verifique antes de fechar'; END IF;
  IF EXISTS (SELECT 1 FROM public.movimentacoes_financeiras m JOIN public.pedidos p ON p.id=m.referencia_id
    WHERE p.sessao_mesa_id=p_sessao_id AND p.tenant_id=p_tenant_id AND m.tenant_id=p_tenant_id)
  THEN RAISE EXCEPTION 'Ja existe lancamento financeiro para esta mesa'; END IF;
  IF p_forma_pagamento='dinheiro' AND COALESCE(p_valor_entregue, v_total)<v_total
  THEN RAISE EXCEPTION 'Valor entregue menor que o total da mesa'; END IF;
  v_troco := CASE WHEN p_forma_pagamento='dinheiro' THEN GREATEST(COALESCE(p_valor_entregue,v_total)-v_total,0) ELSE 0 END;
  FOR v_pedido IN SELECT * FROM public.pedidos
    WHERE sessao_mesa_id=p_sessao_id AND tenant_id=p_tenant_id AND status <> 'cancelado' FOR UPDATE
  LOOP
    UPDATE public.pedidos SET pago=true,pago_em=now(),pago_por='lojista',
      forma_pagamento=ARRAY[p_forma_pagamento],valor_pago=ARRAY[v_pedido.valor_total]
    WHERE id=v_pedido.id;
    INSERT INTO public.movimentacoes_financeiras(tenant_id,tipo,categoria,descricao,valor,data,referencia_id,forma_pagamento)
    VALUES(p_tenant_id,'entrada','pedido','Pedido #' || COALESCE(v_pedido.codigo::text,substring(v_pedido.id::text,1,8)),
      v_pedido.valor_total,CURRENT_DATE,v_pedido.id,p_forma_pagamento);
    v_pago := v_pago+v_pedido.valor_total;
  END LOOP;
  UPDATE public.sessoes_mesa SET status='fechada',data_fechamento=now(),
    forma_pagamento=p_forma_pagamento,valor_pago=COALESCE(p_valor_entregue,v_total),
    troco_para=v_troco,valor_total_recebido=v_pago,valor_total=v_total
  WHERE id=p_sessao_id AND tenant_id=p_tenant_id;
  RETURN jsonb_build_object('ok',true,'sessao_id',p_sessao_id,'valor_total',v_total,
    'valor_total_recebido',v_pago,'forma_pagamento',p_forma_pagamento,'troco_para',v_troco,'pedidos',v_qtd);
END $$;
REVOKE ALL ON FUNCTION public.fechar_sessao_mesa_financeiro(uuid,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_sessao_mesa_financeiro(uuid,uuid,text,numeric) TO service_role;
