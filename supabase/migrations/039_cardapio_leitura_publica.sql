-- Migration 039: leitura anonima segura para o cardapio digital publico
-- Escrita continua protegida pelas policies existentes do lojista.

DROP POLICY IF EXISTS "Cardapio publico ve lojas ativas" ON tenants;
CREATE POLICY "Cardapio publico ve lojas ativas"
  ON tenants FOR SELECT TO anon
  USING (status = 'active');

DROP POLICY IF EXISTS "Cardapio publico ve categorias ativas" ON categorias;
CREATE POLICY "Cardapio publico ve categorias ativas"
  ON categorias FOR SELECT TO anon
  USING (
    ativo = true AND EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = categorias.tenant_id
        AND tenants.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Cardapio publico ve produtos ativos" ON produtos;
CREATE POLICY "Cardapio publico ve produtos ativos"
  ON produtos FOR SELECT TO anon
  USING (
    ativo = true AND EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = produtos.tenant_id
        AND tenants.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Cardapio publico ve variantes" ON variantes;
CREATE POLICY "Cardapio publico ve variantes"
  ON variantes FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM produtos
      WHERE produtos.id = variantes.produto_id
        AND produtos.ativo = true
    )
  );

DROP POLICY IF EXISTS "Cardapio publico ve complementos ativos" ON complementos;
CREATE POLICY "Cardapio publico ve complementos ativos"
  ON complementos FOR SELECT TO anon
  USING (
    ativo = true AND EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = complementos.tenant_id
        AND tenants.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Cardapio publico ve vinculos de complementos" ON produto_complementos;
CREATE POLICY "Cardapio publico ve vinculos de complementos"
  ON produto_complementos FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM produtos
      WHERE produtos.id = produto_complementos.produto_id
        AND produtos.ativo = true
    )
  );

DROP POLICY IF EXISTS "Cardapio publico ve areas de entrega" ON enderecos_entrega;
CREATE POLICY "Cardapio publico ve areas de entrega"
  ON enderecos_entrega FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = enderecos_entrega.tenant_id
        AND tenants.status = 'active'
    )
  );

NOTIFY pgrst, 'reload schema';
