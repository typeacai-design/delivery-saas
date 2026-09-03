-- =====================================================
-- Migration 060: Adicionar campo pontos em pedido_itens
-- Data: 2026-09-03
-- =====================================================

-- Adicionar coluna pontos na tabela pedido_itens
ALTER TABLE pedido_itens
ADD COLUMN IF NOT EXISTS pontos INTEGER DEFAULT 0;

COMMENT ON COLUMN pedido_itens.pontos IS 'Pontos de fidelidade concedidos por este item';

-- Criar índice para buscar pontos por pedido
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pontos ON pedido_itens(pedido_id, pontos);
