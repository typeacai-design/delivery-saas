-- =====================================================
-- Migration 033: Preço riscado + Etiquetas visuais
-- Data: 2026-08-11
-- =====================================================

ALTER TABLE produtos
  -- Preço "de" riscado (mostrado ao lado do real, ex: ~~R$ 28,00~~)
  ADD COLUMN IF NOT EXISTS preco_riscado DECIMAL(10,2),
  -- Etiquetas visuais (texto[]) — "promoção", "mais vendido", "novidade"
  ADD COLUMN IF NOT EXISTS etiquetas TEXT[] DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN produtos.preco_riscado IS 'Preço antes da promoção. Exibido riscado ao lado do preço real.';
COMMENT ON COLUMN produtos.etiquetas IS 'Etiquetas visuais: promocao, mais_vendido, novidade (renderiza tag no cardápio)';

-- Backfill: se secao_destaque era true, marcar como "mais_vendido"
UPDATE produtos
SET etiquetas = ARRAY['mais_vendido']
WHERE secao_destaque = true AND (etiquetas IS NULL OR etiquetas = '{}'::TEXT[]);
