CREATE OR REPLACE FUNCTION public.mobile_marcar_pedido_pago(p_tenant_id uuid, p_pedido_id uuid, p_pago boolean)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE v_pedido record;
BEGIN
  IF p_pago IS NULL OR auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_loja m JOIN public.tenants t ON t.id=m.tenant_id
    WHERE m.user_id=auth.uid() AND m.tenant_id=p_tenant_id AND m.ativo=true
      AND m.role IN ('owner','manager','attendant') AND t.status='active' AND NOT coalesce(t.bloqueado,false)
  ) THEN RAISE EXCEPTION 'Sem permissao' USING ERRCODE='42501'; END IF;

  SELECT id,pago,codigo,valor_total,forma_pagamento INTO v_pedido FROM public.pedidos
  WHERE id=p_pedido_id AND tenant_id=p_tenant_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado' USING ERRCODE='P0002'; END IF;
  IF coalesce(v_pedido.pago,false)=p_pago THEN
    RETURN jsonb_build_object('id',p_pedido_id,'pago',p_pago,'alterado',false);
  END IF;

  UPDATE public.pedidos SET pago=p_pago, pago_em=CASE WHEN p_pago THEN now() ELSE NULL END,
    pago_por=CASE WHEN p_pago THEN 'lojista' ELSE NULL END
  WHERE id=p_pedido_id AND tenant_id=p_tenant_id;

  IF p_pago THEN
    IF NOT EXISTS (SELECT 1 FROM public.movimentacoes_financeiras
      WHERE tenant_id=p_tenant_id AND referencia_id=p_pedido_id AND tipo='entrada' AND categoria IN ('venda','pedido')) THEN
      INSERT INTO public.movimentacoes_financeiras(tenant_id,tipo,descricao,valor,data,categoria,referencia_id,forma_pagamento)
      VALUES(p_tenant_id,'entrada','Pedido #'||coalesce(v_pedido.codigo::text,left(p_pedido_id::text,8)),
        v_pedido.valor_total,(now() AT TIME ZONE 'America/Sao_Paulo')::date,'pedido',p_pedido_id,coalesce(v_pedido.forma_pagamento[1],'outro'));
    END IF;
  ELSE
    DELETE FROM public.movimentacoes_financeiras
    WHERE tenant_id=p_tenant_id AND referencia_id=p_pedido_id AND categoria IN ('venda','pedido') AND tipo='entrada';
  END IF;
  RETURN jsonb_build_object('id',p_pedido_id,'pago',p_pago,'alterado',true);
END;
$function$;

-- Payment-only updates do not change the session total. Avoid running the legacy
-- aggregate trigger for them (its table reads are not part of payment privileges).
CREATE OR REPLACE TRIGGER trigger_atualizar_valor_sessao_mesa
AFTER INSERT OR DELETE OR UPDATE OF status,valor_total,sessao_mesa_id ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_valor_sessao_mesa();

