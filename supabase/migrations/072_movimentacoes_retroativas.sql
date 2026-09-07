-- Migration 072: Criar movimentações retroativas para pedidos pagos sem registro
-- OBJETIVO: Corrigir discrepância no fluxo de caixa
-- SEGURO: Apenas INSERTs em movimentacoes_financeiras com referencia_id

-- Verificar antes quantos serao criados
DO $$
DECLARE
  total_sem_mov INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_sem_mov
  FROM pedidos p
  WHERE p.pago = true
    AND NOT EXISTS (
      SELECT 1 FROM movimentacoes_financeiras mf
      WHERE mf.referencia_id = p.id
        AND mf.categoria IN ('pedido', 'venda')
        AND mf.tipo = 'entrada'
    );

  RAISE NOTICE 'Pedidos pagos sem movimentacao a corrigir: %', total_sem_mov;
END $$;

-- ============================================================
-- Inserir movimentacoes retroativas
-- Para cada pedido pago sem movimentacao, criar uma entrada
-- usando dados do proprio pedido
-- ============================================================
INSERT INTO movimentacoes_financeiras (
  tenant_id,
  tipo,
  categoria,
  descricao,
  valor,
  data,
  referencia_id,
  forma_pagamento,
  created_at
)
SELECT
  p.tenant_id,
  'entrada' as tipo,
  'pedido' as categoria,
  'Pedido #' || COALESCE(p.codigo, SUBSTRING(p.id::text, 1, 8)) || ' (criado retroativamente)' as descricao,
  p.valor_total,
  COALESCE(p.pago_em::date, p.created_at::date) as data,
  p.id as referencia_id,
  COALESCE(
    CASE
      WHEN p.forma_pagamento IS NULL OR array_length(p.forma_pagamento, 1) IS NULL THEN 'outro'
      ELSE p.forma_pagamento[1]
    END,
    'outro'
  ) as forma_pagamento,
  NOW() as created_at
FROM pedidos p
WHERE p.pago = true
  AND p.valor_total > 0
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_financeiras mf
    WHERE mf.referencia_id = p.id
      AND mf.categoria IN ('pedido', 'venda')
      AND mf.tipo = 'entrada'
  );

-- Relatorio final
DO $$
DECLARE
  total_criadas INTEGER;
BEGIN
  GET DIAGNOSTICS total_criadas = ROW_COUNT;
  RAISE NOTICE 'Migration 072 aplicada: % movimentacoes retroativas criadas', total_criadas;
END $$;
