-- Verifica e cria a tabela mensalidades se não existir
CREATE TABLE IF NOT EXISTS mensalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido')),
  data_vencimento DATE,
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensalidades_tenant ON mensalidades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_periodo ON mensalidades(tenant_id, ano DESC, mes DESC);

ALTER TABLE mensalidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lojista vê suas mensalidades" ON mensalidades FOR ALL USING (tenant_id = auth.uid());
