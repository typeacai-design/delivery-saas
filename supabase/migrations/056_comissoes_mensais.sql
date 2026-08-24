-- Migration 056: Remover sistema de mensalidade fixa + adicionar comissoes_mensais
-- Cobranca agora e 1% do faturamento, gerada automaticamente todo dia 05

-- 1. Tabela comissoes_mensais (nova)
CREATE TABLE IF NOT EXISTS public.comissoes_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano >= 2024),
  faturamento_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  percentual DECIMAL(5,2) DEFAULT 1.00 NOT NULL,
  valor_comissao DECIMAL(12,2) NOT NULL DEFAULT 0,
  data_geracao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, mes, ano)
);

-- 2. Grants para comissoes_mensais
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes_mensais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes_mensais TO service_role;

-- 3. RLS para comissoes_mensais
ALTER TABLE public.comissoes_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comissoes_tenant_admin"
  ON public.comissoes_mensais
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Indice para consultas por tenant e data
CREATE INDEX IF NOT EXISTS idx_comissoes_mensais_tenant_periodo
  ON public.comissoes_mensais(tenant_id, ano DESC, mes DESC);

-- 5. Indice para cron job
CREATE INDEX IF NOT EXISTS idx_comissoes_mensais_data_geracao
  ON public.comissoes_mensais(data_geracao);
