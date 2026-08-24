-- Migration 054: Status de pagamento por pedido
-- Adiciona campos para marcar se um pedido foi pago

-- 1. Colunas de pagamento
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pago_por TEXT; -- 'lojista', 'cliente'

-- 2. Grants paraAuthenticated
GRANT SELECT (pago, pago_em, pago_por) ON public.pedidos TO authenticated;
GRANT UPDATE (pago, pago_em, pago_por) ON public.pedidos TO authenticated;

-- 3. Grants para service_role (bypass RLS)
GRANT SELECT (pago, pago_em, pago_por) ON public.pedidos TO service_role;
GRANT UPDATE (pago, pago_em, pago_por) ON public.pedidos TO service_role;

-- 4. Tabela para lancamentos manuais no financeiro
CREATE TABLE IF NOT EXISTS public.movimentacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT DEFAULT 'manual' CHECK (categoria IN ('pedido', 'despesa', 'manual', 'recebimento', 'fornecedor')),
  descricao TEXT,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia_id UUID, -- pode referenciar pedido_id ou despesa_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Grants para movimentacoes_financeiras
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_financeiras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_financeiras TO service_role;

-- 6. RLS para movimentacoes_financeiras
ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem movimentacoes do proprio tenant"
  ON public.movimentacoes_financeiras
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.usuarios_loja WHERE auth.uid() = usuario_id AND ativo = true
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.usuarios_loja WHERE auth.uid() = usuario_id AND ativo = true
  ));

-- Owners tambem veem
CREATE POLICY "Owners veem movimentacoes do proprio tenant"
  ON public.movimentacoes_financeiras
  FOR ALL
  USING (tenant_id IN (
    SELECT id FROM public.tenants WHERE owner_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM public.tenants WHERE owner_id = auth.uid()
  ));

-- 7. Indice para consultas por tenant e data
CREATE INDEX IF NOT EXISTS idx_movimentacoes_financeiras_tenant_data
  ON public.movimentacoes_financeiras(tenant_id, data DESC);
