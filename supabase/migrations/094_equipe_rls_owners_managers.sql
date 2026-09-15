-- 094_equipe_rls_owners_managers.sql
-- Restringe RLS de membros_equipe: somente owner/manager do tenant pode ler/criar/editar/excluir.
-- Owner está em usuarios_loja com role='owner'; manager com role='manager'. Não existe coluna tenants.owner_id.

DROP POLICY IF EXISTS membros_select_authenticated ON membros_equipe;
DROP POLICY IF EXISTS membros_insert_owners ON membros_equipe;
DROP POLICY IF EXISTS membros_update_owners ON membros_equipe;
DROP POLICY IF EXISTS membros_delete_owners ON membros_equipe;

-- Helper: user é owner ou manager ativo do tenant.
-- Expressão reaproveitada em todas as policies via EXISTS.

CREATE POLICY membros_select_gestores_ou_self ON membros_equipe
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuarios_loja ul
      WHERE ul.user_id = auth.uid()
        AND ul.tenant_id = membros_equipe.tenant_id
        AND ul.role IN ('owner', 'manager')
        AND ul.ativo = true
    )
    OR user_id = auth.uid()
  );

CREATE POLICY membros_insert_gestores ON membros_equipe
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_loja ul
      WHERE ul.user_id = auth.uid()
        AND ul.tenant_id = membros_equipe.tenant_id
        AND ul.role IN ('owner', 'manager')
        AND ul.ativo = true
    )
  );

CREATE POLICY membros_update_gestores ON membros_equipe
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM usuarios_loja ul
      WHERE ul.user_id = auth.uid()
        AND ul.tenant_id = membros_equipe.tenant_id
        AND ul.role IN ('owner', 'manager')
        AND ul.ativo = true
    )
  );

CREATE POLICY membros_delete_gestores ON membros_equipe
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM usuarios_loja ul
      WHERE ul.user_id = auth.uid()
        AND ul.tenant_id = membros_equipe.tenant_id
        AND ul.role IN ('owner', 'manager')
        AND ul.ativo = true
    )
  );
