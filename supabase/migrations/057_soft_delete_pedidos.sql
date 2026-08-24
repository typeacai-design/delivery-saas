-- Migration 057: Soft delete para pedidos e campos de auditoria
-- Permite que pedidos cancelados sejam "apagados" pelo lojista
-- mas mantidos para auditoria do admin

-- 1. Adicionar coluna deleted_at na tabela pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS apagado_por TEXT;

-- 2. Grants
GRANT SELECT (deleted_at, apagado_por) ON public.pedidos TO authenticated;
GRANT UPDATE (deleted_at, apagado_por) ON public.pedidos TO authenticated;

-- 3. Tabela de auditoria de pedidos apagados
CREATE TABLE IF NOT EXISTS public.pedidos_apagados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  apagado_em TIMESTAMPTZ DEFAULT NOW(),
  apagado_por TEXT
);

-- 4. Grants para pedidos_apagados
GRANT SELECT, INSERT ON public.pedidos_apagados TO authenticated;
GRANT SELECT, INSERT ON public.pedidos_apagados TO service_role;

-- 5. RLS para pedidos_apagados
ALTER TABLE public.pedidos_apagados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedidos_apagados_tenant"
  ON public.pedidos_apagados
  FOR ALL
  USING (true)
  WITH CHECK (true);
