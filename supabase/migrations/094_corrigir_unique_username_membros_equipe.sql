-- Migration 094: Corrigir constraint unique do username para ser por tenant
-- O username deve ser único apenas dentro da mesma loja

-- Remove índice único global
DROP INDEX IF EXISTS idx_membros_equipe_username;

-- Cria índice único por tenant + username
CREATE UNIQUE INDEX idx_membros_equipe_tenant_username ON membros_equipe(tenant_id, username);
