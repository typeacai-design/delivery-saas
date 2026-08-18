-- Migration 024: permitir INSERT em auditoria para o próprio tenant
-- Necessário pra registrar logs de ações do lojista (ex: salvar horários)

CREATE POLICY "Inserir auditoria da própria loja" ON auditoria
  FOR INSERT WITH CHECK (tenant_id = auth.uid());
