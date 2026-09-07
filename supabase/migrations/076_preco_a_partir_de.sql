-- Migration 076: Adicionar flag para exibir preço como "A partir de"
-- OBJETIVO: Permitir que o lojista marque um produto para mostrar
--           "A partir de R$ X" no cardápio público, mesmo sem variantes
-- SEGURO: Apenas adiciona coluna com default false (não afeta produtos existentes)

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS exibir_preco_a_partir_de BOOLEAN DEFAULT false;

COMMENT ON COLUMN produtos.exibir_preco_a_partir_de IS
  'Se true, exibe o preço como "A partir de R$ X" no cardápio público';

-- Garantir que a coluna possa ser lida pelo público (anon)
-- (já está incluído no grant SELECT básico, mas vamos confirmar)
-- O RLS do cardápio público (Catalogo publico ve produtos ativos) já faz o filtro
-- então não precisamos de policy adicional.
