-- Separa a organização editorial (public.categorias, agora chamada Sessões na UI)
-- da classificação usada como atalho no cardápio público.
CREATE TABLE IF NOT EXISTS categorias_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, nome)
);

ALTER TABLE categorias_produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categorias de produtos do tenant" ON categorias_produtos;
CREATE POLICY "Categorias de produtos do tenant" ON categorias_produtos
  FOR ALL TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
DROP POLICY IF EXISTS "Categorias de produtos publicas" ON categorias_produtos;
CREATE POLICY "Categorias de produtos publicas" ON categorias_produtos
  FOR SELECT TO anon USING (ativo = true AND EXISTS (
    SELECT 1 FROM tenants WHERE tenants.id = categorias_produtos.tenant_id AND tenants.status = 'active'
  ));

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria_produto_id UUID REFERENCES categorias_produtos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_categoria_produto ON produtos(categoria_produto_id);

COMMENT ON TABLE categorias_produtos IS 'Tipos de produto usados como atalhos: Hambúrgueres, Pizzas, Bebidas etc.';
COMMENT ON COLUMN produtos.categoria_id IS 'Sessão editorial do cardápio (tabela categorias).';
COMMENT ON COLUMN produtos.categoria_produto_id IS 'Categoria/tipo do produto usada como filtro rápido.';
