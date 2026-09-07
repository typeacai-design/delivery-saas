-- Migration: 069_permitir_update_avaliacao_tokens
-- Corrige erro "Não foi possível gerar o convite" -
-- as políticas RLS não permitiam UPDATE nas colunas de token de avaliação

-- Adiciona grant para as colunas de token de avaliação
GRANT UPDATE (avaliacao_token_hash, avaliacao_token_expires_at, avaliacao_token_used_at)
ON TABLE public.pedidos TO authenticated;

-- Verifica se funcionou
DO $$
BEGIN
  -- Tenta verificar se o grant foi aplicado
  -- Não hacemos nada, só garantimos que o GRANT foi executado
  RAISE NOTICE 'Migration 069: Grants de avaliacao_token aplicados com sucesso';
END $$;
