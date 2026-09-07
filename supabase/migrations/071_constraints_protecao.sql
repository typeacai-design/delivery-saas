-- Migration 071: Constraints de proteção contra inconsistências futuras
-- OBJETIVO: Impedir que os bugs encontrados voltem a acontecer
-- SEGURO: Apenas adiciona CHECK constraints, não altera dados existentes

-- ============================================================
-- 1. Garantir que cupons esgotados não voltem a ser ativados
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cupons_usos_dentro_limite'
  ) THEN
    ALTER TABLE cupons
      ADD CONSTRAINT cupons_usos_dentro_limite
      CHECK (max_usos IS NULL OR usos_atuais <= max_usos);
  END IF;
END $$;

-- ============================================================
-- 2. Garantir que pedidos não tenham valor_total negativo
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_valor_total_positivo'
  ) THEN
    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_valor_total_positivo
      CHECK (valor_total >= 0);
  END IF;
END $$;

-- ============================================================
-- 3. Garantir que valor_subtotal seja sempre >= valor_desconto
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_desconto_coerente'
  ) THEN
    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_desconto_coerente
      CHECK (valor_subtotal IS NULL OR valor_desconto IS NULL OR (valor_subtotal - valor_desconto) >= 0);
  END IF;
END $$;

-- ============================================================
-- 4. Garantir que clientes tenham telefone válido
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_telefone_minimo'
  ) THEN
    ALTER TABLE clientes
      ADD CONSTRAINT clientes_telefone_minimo
      CHECK (telefone IS NULL OR LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')) >= 10);
  END IF;
END $$;

-- ============================================================
-- 5. Garantir que bairro tenha taxa não-negativa
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enderecos_taxa_nao_negativa'
  ) THEN
    ALTER TABLE enderecos_entrega
      ADD CONSTRAINT enderecos_taxa_nao_negativa
      CHECK (taxa >= 0);
  END IF;
END $$;

-- ============================================================
-- LOG: Confirmar que a migration foi aplicada
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 071 aplicada: 5 constraints de proteção adicionadas';
END $$;
