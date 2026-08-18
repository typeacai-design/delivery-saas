-- Migration 016: Auditoria
-- Log de todas as ações executadas dentro do sistema

CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  acao TEXT NOT NULL,
  tabela TEXT NOT NULL,
  registro_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tenant_created ON auditoria(tenant_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela_registro ON auditoria(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_user ON auditoria(user_id);

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver auditoria da própria loja" ON auditoria
  FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Admin vê toda auditoria" ON auditoria
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'ranieryrick4@gmail.com')
  );

-- Função para registrar auditoria (chamada das APIs)
CREATE OR REPLACE FUNCTION registrar_auditoria(
  p_tenant_id UUID,
  p_user_id UUID,
  p_acao TEXT,
  p_tabela TEXT,
  p_registro_id UUID,
  p_dados_anteriores JSONB,
  p_dados_novos JSONB
) RETURNS void AS $$
BEGIN
  INSERT INTO auditoria (tenant_id, user_id, acao, tabela, registro_id, dados_anteriores, dados_novos)
  VALUES (p_tenant_id, p_user_id, p_acao, p_tabela, p_registro_id, p_dados_anteriores, p_dados_novos);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE auditoria IS 'Log de auditoria: registra ações importantes (criar/editar/excluir)';
