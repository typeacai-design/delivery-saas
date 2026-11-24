-- Carrinho abandonado passa a ser alimentado pelo cardápio público via /api/carrinho/salvar
-- (servidor com service role). Por isso:
-- 1) remove as policies públicas de INSERT/UPDATE (hoje qualquer pessoa podia alterar qualquer carrinho);
-- 2) lojista (owner/manager) continua lendo, removendo e marcando como recuperado;
-- 3) chave única por (tenant, sessão) para upsert e índice para a listagem;
-- 4) entra na publicação do Realtime para o painel atualizar sozinho.

DROP POLICY IF EXISTS "Publico pode salvar carrinho" ON public.carrinho_abandonado;
DROP POLICY IF EXISTS "Publico pode atualizar carrinho" ON public.carrinho_abandonado;
DROP POLICY IF EXISTS "Inserir carrinho" ON public.carrinho_abandonado;
DROP POLICY IF EXISTS "Atualizar carrinho" ON public.carrinho_abandonado;

DROP POLICY IF EXISTS "Gestores atualizam carrinhos do tenant" ON public.carrinho_abandonado;
CREATE POLICY "Gestores atualizam carrinhos do tenant" ON public.carrinho_abandonado
  FOR UPDATE
  USING (public.has_active_tenant_role(tenant_id, ARRAY['owner', 'manager']))
  WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner', 'manager']));

CREATE UNIQUE INDEX IF NOT EXISTS carrinho_abandonado_tenant_sessao_key
  ON public.carrinho_abandonado (tenant_id, session_id);
CREATE INDEX IF NOT EXISTS carrinho_abandonado_tenant_acesso_idx
  ON public.carrinho_abandonado (tenant_id, ultimo_acesso DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'carrinho_abandonado'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.carrinho_abandonado;
  END IF;
END $$;
