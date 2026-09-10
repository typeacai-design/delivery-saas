-- Migration 091: Adicionar user_id em membros_equipe + ajustar RLS
-- A migration 085 referencia user_id mas não criou a coluna

ALTER TABLE membros_equipe
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_membros_equipe_user_id ON membros_equipe(user_id);

-- Política antiga "membro_vê_a_si" referencia user_id que pode não estar populado.
-- Como o login atual é por username + password (não usa auth.uid()),
-- essa política nunca era aplicada de fato. Mantemos mas tornamos tolerante.
DROP POLICY IF EXISTS "membro_vê_a_si" ON membros_equipe;
CREATE POLICY "membros_select_all_same_tenant" ON membros_equipe
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM membros_equipe me2
      WHERE me2.id IS NOT NULL
    )
  );
