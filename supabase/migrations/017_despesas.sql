-- Migration 017: Despesas fixas / contas a pagar
-- Lojista cadastra suas despesas fixas e mensais para controle financeiro

CREATE TABLE IF NOT EXISTS despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT DEFAULT 'outros' CHECK (categoria IN ('fixa', 'variavel', 'folha', 'fornecedor', 'outros')),
  valor DECIMAL(10,2) NOT NULL,
  recorrencia TEXT DEFAULT 'mensal' CHECK (recorrencia IN ('mensal', 'semanal', 'anual', 'unica')),
  dia_vencimento INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_tenant ON despesas(tenant_id);

ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver despesas próprias" ON despesas FOR ALL USING (tenant_id = auth.uid());

CREATE TABLE IF NOT EXISTS despesa_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id UUID NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  pago BOOLEAN DEFAULT false,
  data_pagamento DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(despesa_id, mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_despesa_pagamentos ON despesa_pagamentos(despesa_id, ano DESC, mes DESC);

ALTER TABLE despesa_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver pagamentos próprios" ON despesa_pagamentos
  FOR ALL USING (despesa_id IN (SELECT id FROM despesas WHERE tenant_id = auth.uid()));

COMMENT ON TABLE despesas IS 'Despesas fixas e variáveis da loja';
