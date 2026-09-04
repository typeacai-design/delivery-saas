-- Migration 062: Trigger automático para entrada no fluxo de caixa quando pedido marcado como pago
-- Garante que sempre que pago=true, há uma entrada em movimentacoes_financeiras.
-- Se já existir uma movimentação com mesmo referencia_id, não duplica (UPSERT).

CREATE OR REPLACE FUNCTION public.fn_pedido_pago_gerar_fluxo_caixa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_codigo text;
  v_forma_pagamento text;
BEGIN
  -- Só age quando pago transita de false → true
  IF (TG_OP = 'UPDATE' AND OLD.pago IS NOT DISTINCT FROM NEW.pago) THEN
    RETURN NEW;
  END IF;

  IF NEW.pago IS NOT TRUE THEN
    -- Se desmarcou, remove a entrada automática
    DELETE FROM public.movimentacoes_financeiras
     WHERE tenant_id = NEW.tenant_id
       AND referencia_id = NEW.id
       AND categoria = 'pedido';
    RETURN NEW;
  END IF;

  -- Não duplica: se já existe movimentação com referencia_id, atualiza valor/descrição
  v_codigo := COALESCE(NEW.codigo, SUBSTRING(NEW.id::text, 1, 8));
  v_forma_pagamento := CASE
    WHEN jsonb_typeof(NEW.forma_pagamento::jsonb) = 'array' THEN
      (NEW.forma_pagamento::jsonb ->> 0)
    ELSE
      NEW.forma_pagamento::text
  END;

  INSERT INTO public.movimentacoes_financeiras (
    tenant_id, tipo, categoria, descricao, valor, data, referencia_id, forma_pagamento
  ) VALUES (
    NEW.tenant_id,
    'entrada',
    'pedido',
    'Pedido #' || v_codigo,
    NEW.valor_total,
    CURRENT_DATE,
    NEW.id,
    v_forma_pagamento
  )
  ON CONFLICT (referencia_id) WHERE referencia_id IS NOT NULL
  DO UPDATE SET
    valor = EXCLUDED.valor,
    descricao = EXCLUDED.descricao,
    forma_pagamento = EXCLUDED.forma_pagamento;

  RETURN NEW;
END;
$$;

-- Precisa de índice único em referencia_id para o ON CONFLICT funcionar
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimentacoes_referencia_id
  ON public.movimentacoes_financeiras (referencia_id)
  WHERE referencia_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_pedido_pago_fluxo_caixa ON public.pedidos;
CREATE TRIGGER trg_pedido_pago_fluxo_caixa
  AFTER INSERT OR UPDATE OF pago ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_pedido_pago_gerar_fluxo_caixa();
