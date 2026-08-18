-- =====================================================
-- Migration 032: Melhorias em Complementos (estilo AnotaAI)
-- Lista de Complementos com min/max + Complementos com
-- descrição, etiquetas, estoque.
-- Data: 2026-08-11
-- =====================================================

ALTER TABLE categorias_complementos
  -- Quantidade mínima e máxima selecionável na lista
  ADD COLUMN IF NOT EXISTS qtd_minima INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_maxima INTEGER DEFAULT 1,
  -- Descrição interna (não aparece no cardápio)
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  -- Limite de 1 unidade de cada item (ex: pizza meio a meio)
  ADD COLUMN IF NOT EXISTS max_um_de_cada BOOLEAN DEFAULT false,
  -- Imagem da lista
  ADD COLUMN IF NOT EXISTS imagem_url TEXT;

COMMENT ON COLUMN categorias_complementos.qtd_minima IS 'Qtd mínima obrigatória (0 = opcional)';
COMMENT ON COLUMN categorias_complementos.qtd_maxima IS 'Qtd máxima que o cliente pode selecionar';
COMMENT ON COLUMN categorias_complementos.max_um_de_cada IS 'True = permite só 1 de cada item';
COMMENT ON COLUMN categorias_complementos.imagem_url IS 'Imagem ilustrativa da lista';

ALTER TABLE complementos
  -- Descrição (ex: "Coberto com chocolate")
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  -- Custo (relatório de lucratividade)
  ADD COLUMN IF NOT EXISTS custo DECIMAL(10,2) DEFAULT 0,
  -- 3 etiquetas customizadas (ex: "Vegano", "Sem glúten")
  ADD COLUMN IF NOT EXISTS etiqueta1 TEXT,
  ADD COLUMN IF NOT EXISTS etiqueta2 TEXT,
  ADD COLUMN IF NOT EXISTS etiqueta3 TEXT,
  -- Controle de estoque
  ADD COLUMN IF NOT EXISTS controlar_estoque BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantidade_estoque INTEGER DEFAULT 0,
  -- Imagem própria
  ADD COLUMN IF NOT EXISTS imagem_url TEXT;

COMMENT ON COLUMN complementos.custo IS 'Custo de aquisição (relatórios)';
COMMENT ON COLUMN complementos.controlar_estoque IS 'Baixa estoque ao usar';
COMMENT ON COLUMN complementos.quantidade_estoque IS 'Qtd em estoque';
