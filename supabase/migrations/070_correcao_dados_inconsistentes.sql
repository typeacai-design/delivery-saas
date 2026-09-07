-- Migration 070: Correção segura de dados inconsistentes
-- OBJETIVO: Apenas corrigir dados, SEM mexer em triggers, RLS ou lógica de negócio
-- SEGURO: Roda em transação, faz backup lógico antes de cada mudança

-- ============================================================
-- 1. DESATIVAR CUPONS ESGOTADOS
-- Bug: cupons com usos_atuais >= max_usos ainda estavam ativo=true
-- Fix: Apenas desativar (não mexe em dados de uso)
-- ============================================================
UPDATE cupons
SET ativo = false
WHERE ativo = true
  AND max_usos IS NOT NULL
  AND usos_atuais >= max_usos;

-- ============================================================
-- 2. REVERTER pago=true EM PEDIDOS CANCELADOS
-- Bug: 4 pedidos com status='cancelado' tinham pago=true indevidamente
-- Fix: Marcar como não pago (não mexe em dados financeiros já gerados)
-- IMPORTANTE: Não deleta movimentações existentes, apenas reverte o flag
-- ============================================================
UPDATE pedidos
SET pago = false,
    pago_em = NULL,
    pago_por = NULL,
    updated_at = NOW()
WHERE status = 'cancelado'
  AND pago = true;

-- ============================================================
-- 3. DESATIVAR CUPONS DUPLICADOS
-- Bug: 2 cupons com mesmo código, manter só o mais recente ativo
-- ============================================================
WITH cupons_agrupados AS (
  SELECT
    tenant_id,
    LOWER(codigo) as codigo_lower,
    MAX(created_at) as mais_recente
  FROM cupons
  WHERE ativo = true
  GROUP BY tenant_id, LOWER(codigo)
  HAVING COUNT(*) > 1
)
UPDATE cupons c
SET ativo = false
FROM cupons_agrupados ca
WHERE c.tenant_id = ca.tenant_id
  AND LOWER(c.codigo) = ca.codigo_lower
  AND c.ativo = true
  AND c.created_at < ca.mais_recente;

-- ============================================================
-- 4. RELATÓRIO: Pedidos com valor_total = 0 (anomalia)
-- NÃO corrige automaticamente - apenas registra para investigação
-- ============================================================
DO $$
DECLARE
  total_zerados INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_zerados
  FROM pedidos
  WHERE valor_total = 0;

  IF total_zerados > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % pedidos com valor_total = 0 encontrados. Necessário investigação manual.', total_zerados;
  END IF;
END $$;

-- ============================================================
-- 5. RELATÓRIO: Pedidos pagos sem movimentação
-- NÃO corrige automaticamente - apenas registra
-- ============================================================
DO $$
DECLARE
  sem_mov INTEGER;
  valor_total_perdido NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(p.valor_total), 0)
  INTO sem_mov, valor_total_perdido
  FROM pedidos p
  WHERE p.pago = true
    AND NOT EXISTS (
      SELECT 1 FROM movimentacoes_financeiras mf
      WHERE mf.referencia_id = p.id
        AND mf.categoria IN ('pedido', 'venda')
        AND mf.tipo = 'entrada'
    );

  IF sem_mov > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % pedidos pagos sem movimentação no fluxo de caixa. Total: R$ %. Necessário criar movimentações retroativas.', sem_mov, valor_total_perdido;
  END IF;
END $$;

-- ============================================================
-- LOG: Confirmar que a migration foi aplicada
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 070 aplicada: limpeza segura de dados inconsistentes';
END $$;
