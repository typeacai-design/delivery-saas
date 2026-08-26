-- Migration 058: Liberar UPDATE em campos de pagamento e desconto
-- O trigger validar_atualizacao_operacional_pedido (criado em 047) só
-- permitia UPDATE em (status, data_atualizacao, motoboy_id, motoboy_comissao).
-- Tentativas de UPDATE em pago, pago_em, pago_por, valor_desconto, valor_total
-- disparavam RAISE EXCEPTION 'campos de pedido nao autorizados'.

CREATE OR REPLACE FUNCTION public.validar_atualizacao_operacional_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_old text := OLD.status::text; v_new text := NEW.status::text;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT role INTO v_role FROM public.usuarios_loja
   WHERE user_id=auth.uid() AND tenant_id=OLD.tenant_id AND ativo=true
   ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END LIMIT 1;
  IF v_role IS NULL OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN RAISE EXCEPTION 'pedido nao autorizado'; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','data_atualizacao','motoboy_id','motoboy_comissao','pago','pago_em','pago_por','valor_desconto','valor_total']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','data_atualizacao','motoboy_id','motoboy_comissao','pago','pago_em','pago_por','valor_desconto','valor_total']) THEN RAISE EXCEPTION 'campos de pedido nao autorizados'; END IF;
  IF v_role IN ('owner','manager') THEN RETURN NEW; END IF;
  IF NEW.motoboy_id IS DISTINCT FROM OLD.motoboy_id THEN RAISE EXCEPTION 'papel nao pode atribuir motoboy'; END IF;
  IF v_role='attendant' AND NOT (v_new=v_old OR (v_old='novo' AND v_new IN ('preparando','cancelado'))) THEN RAISE EXCEPTION 'transicao nao permitida'; END IF;
  IF v_role='kitchen' AND NOT (v_new=v_old OR (v_old IN ('novo','preparando') AND v_new IN ('preparando','pronto'))) THEN RAISE EXCEPTION 'transicao nao permitida'; END IF;
  IF v_role IN ('delivery','motoboy') AND NOT (v_new=v_old OR (v_old='pronto' AND v_new='saiu') OR (v_old='saiu' AND v_new='entregue')) THEN RAISE EXCEPTION 'transicao nao permitida'; END IF;
  RETURN NEW;
END $$;

-- Garantir que authenticated pode UPDATE em valor_desconto e valor_total
GRANT UPDATE (valor_desconto, valor_total) ON TABLE public.pedidos TO authenticated;
