-- Adiciona coluna deleted_at em produtos para suportar soft delete.
-- O codigo em src/app/(dashboard)/cardapio/page.tsx ja filtrava
-- `.is('deleted_at', null)` mas a coluna nunca foi criada, fazendo
-- a query retornar zero produtos nas abas de Produtos e Sessões.

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_produtos_deleted_at ON public.produtos(deleted_at) WHERE deleted_at IS NULL;
