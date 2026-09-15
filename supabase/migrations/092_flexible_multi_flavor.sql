-- Migration 092: Flexible multi-flavor products
-- Data: 2026-09-14
-- =====================================================
-- Remove o CHECK fixo em sabores_maximo (antes: apenas 2 ou 3)
-- para permitir qualquer quantidade de 1 a 10.
-- Transforma pode_ser_metade e fracionar_item em campos obsoletos
-- (mantidos no DB para compatibilidade, mas descontinuados na UI).

-- 1) Remove o CHECK constraint antigo
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_sabores_maximo_check;

-- 2) Recria com novo range (1 a 10)
ALTER TABLE produtos
  ADD CONSTRAINT produtos_sabores_maximo_check
  CHECK (sabores_maximo >= 1 AND sabores_maximo <= 10);

-- 3) Atualiza default de 2 para 1
ALTER TABLE produtos ALTER COLUMN sabores_maximo SET DEFAULT 1;
ALTER TABLE produtos ALTER COLUMN sabores_maximo SET NOT NULL;

-- 4) Obsoleta: pode_ser_metade e fracionar_item
-- Não remover as colunas para não quebrar produtos existentes.
-- Comentários marcam como descontinuados.
COMMENT ON COLUMN produtos.pode_ser_metade IS 'OBSOLETO — use sabores_grupo_id. Item é dividido em sabores configurados no produto.';
COMMENT ON COLUMN produtos.fracionar_item IS 'OBSOLETO — funcionalidade removida da UI.';
COMMENT ON COLUMN produtos.eh_adicional IS 'OBSOLETO — funcionalidade removida da UI.';

-- 5) Nova coluna para substituir o CHECK fixo de 2 ou 3
-- A constraint acima já cobre isso, mas documenta a intenção.
COMMENT ON COLUMN produtos.sabores_maximo IS 'Quantidade maxima de sabores selecionaveis (1 a 10). 0 ou NULL = sem sabores.';

-- =====================================================
-- Atualiza flavor-pricing para aceitar count de 1 a 10
-- (já suporta, só garante que o type aceita).
-- =====================================================
