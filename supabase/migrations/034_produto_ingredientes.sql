-- =====================================================
-- Migration 034: Vínculo Produto ↔ Matéria-prima
-- Data: 2026-08-11
-- Sprint 2 — ingrediente do produto baixa estoque
-- =====================================================
--
-- Conceito:
-- - Lojista cadastra MATÉRIA-PRIMA (= insumos que entram no produto)
-- - Ao cadastrar produto (ex: Hambúrguer X), vincula ingredientes
--   com quantidade que cada unidade do produto consome
-- - Ao confirmar pedido, baixa estoque automaticamente
--
-- A tabela `insumos` (já existente na migration 019_capacidade.sql) é
-- usada como matéria-prima. Não duplicamos.

CREATE TABLE IF NOT EXISTS produto_ingredientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  quantidade DECIMAL(10,3) NOT NULL, -- qtd do insumo por 1 unidade do produto
                                   -- usa a unidade cadastrada no insumo (g, ml, un, etc)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produto_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_produto_ingredientes_produto ON produto_ingredientes(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_ingredientes_insumo ON produto_ingredientes(insumo_id);

ALTER TABLE produto_ingredientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver ingredientes próprios" ON produto_ingredientes
  FOR ALL USING (tenant_id = auth.uid());

COMMENT ON TABLE produto_ingredientes IS 'Vincula produto ↔ insumo/matéria-prima com quantidade usada por unidade';
COMMENT ON COLUMN produto_ingredientes.quantidade IS 'Quantidade do insumo consumida por 1 unidade do produto (usa a unidade do insumo)';
