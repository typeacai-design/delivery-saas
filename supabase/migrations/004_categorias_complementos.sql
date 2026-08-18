-- ================================================
-- MIGRATION 004: Categorias de complementos
-- Permite agrupar complementos em categorias
-- ================================================

-- Tabela de categorias de complementos
CREATE TABLE IF NOT EXISTS categorias_complementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para categorias_complementos
ALTER TABLE categorias_complementos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias comp visíveis ao tenant" ON categorias_complementos
  FOR ALL USING (tenant_id = auth.uid());

-- Adicionar coluna categoria_id na tabela complementos
ALTER TABLE complementos
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias_complementos(id) ON DELETE SET NULL;

-- Adicionar ordem na tabela complementos
ALTER TABLE complementos
ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

-- Atualizar RLS da tabela complementos para verificar via tenant
DROP POLICY IF EXISTS "Complementos visíveis ao tenant" ON complementos;
CREATE POLICY "Complementos visíveis ao tenant" ON complementos
  FOR ALL USING (
    tenant_id = auth.uid() OR
    tenant_id IN (SELECT tenant_id FROM categorias_complementos WHERE id = categoria_id AND tenant_id = auth.uid())
  );
