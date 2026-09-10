-- Migration 092: Corrigir recursão infinita na policy de membros_equipe
DROP POLICY IF EXISTS "membros_select_all_same_tenant" ON membros_equipe;
DROP POLICY IF EXISTS "membro_vê_a_si" ON membros_equipe;

CREATE POLICY "membros_select_authenticated" ON membros_equipe
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "membros_insert_owners" ON membros_equipe
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "membros_update_owners" ON membros_equipe
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "membros_delete_owners" ON membros_equipe
  FOR DELETE TO authenticated USING (true);
