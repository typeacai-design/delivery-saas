-- Migration 011: PIX Mensalidade + Configuração global do SaaS
-- Tabela de configuração global (1 linha por chave) e tabela de pagamentos PIX

CREATE TABLE IF NOT EXISTS saas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO saas_config (chave, valor) VALUES
  ('pix', '{"chave": "", "nome_recebedor": "We Delivery", "cidade": "SAO PAULO", "tx_id_prefixo": "WE"}'),
  ('trial', '{"limite_faturamento_mensal": 2000, "valor_mensalidade": 59.90, "dia_vencimento": 10}'),
  ('geral', '{"manutencao": false, "versao": "1.0", "mensagem_manutencao": ""}')
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE saas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem config pública" ON saas_config FOR SELECT USING (true);
CREATE POLICY "Apenas admin atualiza config" ON saas_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'ranieryrick4@gmail.com')
  );

CREATE TABLE IF NOT EXISTS pix_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  mensalidade_id UUID REFERENCES mensalidades(id),
  valor DECIMAL(10,2) NOT NULL,
  txid VARCHAR(35) UNIQUE NOT NULL,
  br_code TEXT NOT NULL,
  qr_code_base64 TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  expiracao TIMESTAMPTZ NOT NULL,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pix_pagamentos_tenant ON pix_pagamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pix_pagamentos_status ON pix_pagamentos(status);

ALTER TABLE pix_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lojista vê seus pagamentos" ON pix_pagamentos
  FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Admin gerencia pagamentos" ON pix_pagamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'ranieryrick4@gmail.com')
  );

COMMENT ON TABLE saas_config IS 'Configurações globais do SaaS (chave/valor JSON)';
COMMENT ON TABLE pix_pagamentos IS 'Histórico de pagamentos PIX das mensalidades';
