-- ================================================
-- Migration 005: tempo de preparo por produto
-- ================================================
-- Cada produto tem seu próprio tempo de preparo.
-- Esse tempo aparece no cardápio público pro cliente final
-- e entra no cálculo de tempo de entrega via WhatsApp.

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS tempo_preparo_min INTEGER DEFAULT 30 NOT NULL;

-- Aplicar default aos produtos existentes (que já existem sem a coluna)
UPDATE produtos
  SET tempo_preparo_min = 30
  WHERE tempo_preparo_min IS NULL;

-- Comentário pra documentar
COMMENT ON COLUMN produtos.tempo_preparo_min IS 'Tempo médio de preparo do produto em minutos. Aparece no cardápio público e no checkout WhatsApp.';
