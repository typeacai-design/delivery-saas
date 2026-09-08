-- Migration 079: Melhorias no carrinho abandonado
-- OBJETIVO: Permitir que clientes anonimos salvem carrinhos, mas so lojistas veem
-- SEGURO: Apenas ajusta policies, nao modifica dados

-- Remover policy antiga que era restritiva demais
DROP POLICY IF EXISTS "Gestores administram dados do tenant" ON carrinho_abandonado;
DROP POLICY IF EXISTS "Gestores leem dados do tenant" ON carrinho_abandonado;

-- 1. Policy para INSERT/UPDATE publico (qualquer um pode salvar carrinho anonimamente)
CREATE POLICY "Publico pode salvar carrinho" ON carrinho_abandonado
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Publico pode atualizar carrinho" ON carrinho_abandonado
  FOR UPDATE USING (true) WITH CHECK (true);

-- 2. Policy para SELECT do lojista
CREATE POLICY "Gestores leem carrinhos do tenant" ON carrinho_abandonado
  FOR SELECT USING (has_active_tenant_role(tenant_id, ARRAY['owner', 'manager']));

-- 3. Policy para DELETE apenas lojistas
CREATE POLICY "Gestores podem remover carrinhos" ON carrinho_abandonado
  FOR DELETE USING (has_active_tenant_role(tenant_id, ARRAY['owner', 'manager']));
