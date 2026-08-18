-- ================================================
-- MIGRATION 003: Campos de cadastro completo
-- Adiciona dados do responsável e endereço do negócio
-- ================================================

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS estado TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS numero TEXT,
ADD COLUMN IF NOT EXISTS complemento TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS nome_responsavel TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Atualizar policy para permitir UPDATE em todos esses campos
DROP POLICY IF EXISTS "Usuários atualizam seu próprio tenant" ON tenants;
CREATE POLICY "Usuários atualizam seu próprio tenant" ON tenants
  FOR UPDATE USING (auth.uid() = id);
