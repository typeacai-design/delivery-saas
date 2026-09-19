-- Migration 093: Corrigir políticas RLS da tabela membros_equipe
-- As políticas atuais permitem qualquer usuário autenticado gerenciar qualquer membro
-- O endpoint /api/membros-equipe usa service_role, então não é afetado
-- Mas criamos políticas corretas caso o frontend use o cliente anônimo/autenticado

-- Remover políticas anteriores (muito permissivas)
DROP POLICY IF EXISTS "membros_select_authenticated" ON membros_equipe;
DROP POLICY IF EXISTS "membros_insert_owners" ON membros_equipe;
DROP POLICY IF EXISTS "membros_update_owners" ON membros_equipe;
DROP POLICY IF EXISTS "membros_delete_owners" ON membros_equipe;

-- Permitir que membros vejam outros membros da mesma loja
-- (útil para páginas de cozinha/motoboy que buscam pedidos via tenant_id)
CREATE POLICY "membros_equipe_select_por_tenant" ON membros_equipe
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_loja
      WHERE user_id = auth.uid()
    )
  );

-- Somente usuários com role owner/admin/manager na loja podem gerenciar membros
CREATE POLICY "membros_equipe_insert_por_tenant" ON membros_equipe
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_loja
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "membros_equipe_update_por_tenant" ON membros_equipe
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_loja
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "membros_equipe_delete_por_tenant" ON membros_equipe
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_loja
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Habilitar RLS na tabela (caso ainda não esteja)
ALTER TABLE membros_equipe ENABLE ROW LEVEL SECURITY;
