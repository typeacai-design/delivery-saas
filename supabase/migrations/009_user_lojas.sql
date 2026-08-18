-- Migration 009: Multi-loja por user
-- Tabela N:N que permite um user acessar múltiplas lojas

CREATE TABLE IF NOT EXISTS user_lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'attendant')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_lojas_user ON user_lojas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lojas_tenant ON user_lojas(tenant_id);

ALTER TABLE user_lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver próprias lojas" ON user_lojas
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Owner adiciona lojas" ON user_lojas
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner gerencia próprias lojas" ON user_lojas
  FOR ALL USING (user_id = auth.uid());

COMMENT ON TABLE user_lojas IS 'Relacionamento N:N entre usuários e lojas. Permite 1 user acessar várias lojas.';
