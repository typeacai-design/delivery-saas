-- Migration 051: Adicionar coluna imagem_url em categorias
-- Problema: lojista não conseguia criar sessão de produtos

ALTER TABLE categorias ADD COLUMN IF NOT EXISTS imagem_url TEXT;

COMMENT ON COLUMN categorias.imagem_url IS 'Banner/imagem da sessão no cardápio público';

-- Garantir que a coluna não seja NOT NULL
ALTER TABLE categorias ALTER COLUMN imagem_url DROP NOT NULL;
