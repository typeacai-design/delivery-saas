-- Native payment transition and its cashflow entry commit or roll back together.
-- SECURITY INVOKER deliberately retains tenant RLS in addition to explicit guards.
CREATE FUNCTION public.mobile_marcar_pedido_pago(p_tenant_id uuid, p_pedido_id uuid, p_pago boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_pedido public.pedidos%ROWTYPE;
BEGIN
  IF p_pago IS NULL OR auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios_loja m JOIN public.tenants t ON t.id=m.tenant_id
    WHERE m.user_id=auth.uid() AND m.tenant_id=p_tenant_id AND m.ativo=true
      AND m.role IN ('owner','manager','attendant') AND t.status='active' AND NOT coalesce(t.bloqueado,false)
  ) THEN RAISE EXCEPTION 'Sem permissao' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_pedido FROM public.pedidos
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
        v_pedido.valor_total,(now() AT TIME ZONE 'America/Sao_Paulo')::date,'venda',p_pedido_id,coalesce(v_pedido.forma_pagamento[1],'outro'));
    END IF;
  ELSE
    DELETE FROM public.movimentacoes_financeiras
    WHERE tenant_id=p_tenant_id AND referencia_id=p_pedido_id AND categoria IN ('venda','pedido') AND tipo='entrada';
  END IF;
  RETURN jsonb_build_object('id',p_pedido_id,'pago',p_pago,'alterado',true);
END;
$$;
REVOKE ALL ON FUNCTION public.mobile_marcar_pedido_pago(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mobile_marcar_pedido_pago(uuid,uuid,boolean) TO authenticated;
COMMENT ON FUNCTION public.mobile_marcar_pedido_pago(uuid,uuid,boolean) IS 'Native payment transition: explicit active membership + tenant RLS, row lock, atomic ledger and idempotent replay.';
NOTIFY pgrst, 'reload schema';
