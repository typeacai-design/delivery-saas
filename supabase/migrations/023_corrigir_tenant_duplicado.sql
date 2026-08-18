-- ================================================
-- Migration 023: Corrigir bug de tenant duplicado
-- ================================================
-- PROBLEMA: A trigger handle_new_user() cria um tenant PARCIAL
-- quando o usuário faz signUp, e depois o código tenta inserir OUTRO tenant.
-- Resultado: tenant com dados incompletos (faltando email, numero, etc)
--
-- SOLUÇÃO: Remover a trigger automática. O INSERT será feito APENAS
-- pelo código do formulário de registro, que tem todos os campos.

-- 1. Remover a trigger que cria tenant automático no signUp
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Garantir que INSERT não dá erro se trigger deixou registro incompleto
-- (删除 registros órfãos onde tenant_id não existe mais em auth.users)
DELETE FROM tenants WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE auth.users.id = tenants.id
);

-- 3. Garantir que não há tenant duplicado (mesmo id) — não deveria existir, mas previne
-- Se houver, manter o mais recente
DELETE FROM tenants t1 USING tenants t2
WHERE t1.id = t2.id AND t1.created_at < t2.created_at;

-- 4. Garantir que as colunas aceitam NULL (o INSERT do registro pode ter campos vazios)
ALTER TABLE tenants ALTER COLUMN email DROP NOT NULL;
ALTER TABLE tenants ALTER COLUMN numero DROP NOT NULL;
ALTER TABLE tenants ALTER COLUMN complemento DROP NOT NULL;

-- 5. Adicionar policy RLS de INSERT para o usuário criar SEU próprio tenant
-- (sem isso, o INSERT do código falha silenciosamente)
DROP POLICY IF EXISTS "Usuários criam seu próprio tenant" ON tenants;
CREATE POLICY "Usuários criam seu próprio tenant" ON tenants
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Adicionar policy RLS de UPDATE para o usuário editar SEU próprio tenant
DROP POLICY IF EXISTS "Usuários editam seu próprio tenant" ON tenants;
CREATE POLICY "Usuários editam seu próprio tenant" ON tenants
  FOR UPDATE USING (auth.uid() = id);
