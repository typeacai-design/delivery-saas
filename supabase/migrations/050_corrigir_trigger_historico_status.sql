-- Migration: 050_corrigir_trigger_historico_status
-- Data: 2026-08-20
-- Bug: 'record "new" has no field "criado_por"'
-- Causa: Trigger fn_historico_status tentava acessar NEW.criado_por na tabela pedidos
-- Solução: Usar NULL diretamente já que pedidos via API pública não têm criado_por

CREATE OR REPLACE FUNCTION public.fn_historico_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO pedido_status_historico (pedido_id, status, criado_por)
    VALUES (NEW.id, NEW.status, NULL);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO pedido_status_historico (pedido_id, status, criado_por)
    VALUES (NEW.id, NEW.status, NULL);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
