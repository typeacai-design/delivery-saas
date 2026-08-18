-- ================================================
-- Migration 007: status de aprovação do lojista
-- ================================================
-- Adiciona controle de aprovação:
-- - pending_approval: lojista cadastrou mas Rick ainda não aprovou
-- - active: lojista aprovado e com acesso liberado
-- - suspended: lojista suspenso por Rick

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'active', 'suspended'));

-- Trigger que define status inicial:
-- quando o tenant é criado pelo signup público (auth.users via handle_new_user),
-- status começa como pending_approval.
-- Quando Rick cria direto pelo painel admin (service role), status = active.

-- Recriar função de criação automática se existir
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Se o user_metadata trouxer status (caso Rick crie via service role),
  -- respeita o valor. Caso contrário, vai como pending_approval.
  v_status := COALESCE(NEW.raw_user_meta_data->>'status', 'pending_approval');

  INSERT INTO public.tenants (id, nome, slug, status, categoria, telefone, estado, cidade, endereco, nome_responsavel, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Meu Negócio'),
    LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'nome', 'meu-negocio'), '[^a-zA-Z0-9]+', '-', 'g')),
    v_status,
    NEW.raw_user_meta_data->>'categoria',
    NEW.raw_user_meta_data->>'telefone',
    NEW.raw_user_meta_data->>'estado',
    NEW.raw_user_meta_data->>'cidade',
    NEW.raw_user_meta_data->>'endereco',
    NEW.raw_user_meta_data->>'nome_responsavel',
    NEW.raw_user_meta_data->>'cpf'
  );
  RETURN NEW;
END;
$$;

-- Atualizar política para permitir admin (via service role) ver todos os tenants
DROP POLICY IF EXISTS "Usuários veem seu próprio tenant" ON tenants;
CREATE POLICY "Usuários veem seu próprio tenant" ON tenants
  FOR SELECT USING (auth.uid() = id);

-- Service role ignora RLS automaticamente — sem política adicional necessária
-- Admin Rick acessa via service role key nos endpoints /api/admin/*

-- Comentário
COMMENT ON COLUMN tenants.status IS 'pending_approval | active | suspended';
