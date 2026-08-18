-- Migration 008: Multi-usuário por loja
-- Tabela para gerenciar múltiplos usuários por loja com roles

CREATE TABLE IF NOT EXISTS usuarios_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'attendant' CHECK (role IN ('owner', 'manager', 'attendant')),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_loja_tenant ON usuarios_loja(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_loja_user ON usuarios_loja(user_id);

ALTER TABLE usuarios_loja ENABLE ROW LEVEL SECURITY;

-- Ver usuários da própria loja (todos os usuários da loja veem os outros)
CREATE POLICY "Ver usuários da própria loja" ON usuarios_loja
  FOR SELECT USING (
    user_id = auth.uid() OR
    tenant_id IN (SELECT tenant_id FROM usuarios_loja WHERE user_id = auth.uid())
  );

-- Owner e manager podem inserir novos usuários
CREATE POLICY "Owner e manager inserem usuários" ON usuarios_loja
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_loja
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND ativo = true
    ) OR
    -- Permite o próprio dono criar (primeiro registro)
    NOT EXISTS (SELECT 1 FROM usuarios_loja WHERE user_id = auth.uid())
  );

-- Apenas owner pode atualizar/excluir usuários
CREATE POLICY "Owner gerencia usuários" ON usuarios_loja
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_loja
      WHERE user_id = auth.uid() AND role = 'owner' AND ativo = true
    )
  );

CREATE POLICY "Owner deleta usuários" ON usuarios_loja
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_loja
      WHERE user_id = auth.uid() AND role = 'owner' AND ativo = true
    )
  );

-- Comentário
COMMENT ON TABLE usuarios_loja IS 'Gerencia múltiplos usuários por loja com roles: owner, manager, attendant';
