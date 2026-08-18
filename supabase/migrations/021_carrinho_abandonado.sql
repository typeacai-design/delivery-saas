-- Migration 021: Carrinho abandonado
-- Rastreia carrinhos que o cliente montou mas não finalizou

CREATE TABLE IF NOT EXISTS carrinho_abandonado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id TEXT NOT NULL,
  itens JSONB NOT NULL DEFAULT '[]',
  cliente_nome TEXT,
  cliente_whatsapp TEXT,
  valor_total DECIMAL(10,2),
  recuperado BOOLEAN DEFAULT false,
  ultimo_acesso TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrinho_abandonado_tenant ON carrinho_abandonado(tenant_id, ultimo_acesso DESC);
CREATE INDEX IF NOT EXISTS idx_carrinho_abandonado_session ON carrinho_abandonado(tenant_id, session_id);

ALTER TABLE carrinho_abandonado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver carrinhos da loja" ON carrinho_abandonado FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Inserir carrinho" ON carrinho_abandonado FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizar carrinho" ON carrinho_abandonado FOR UPDATE USING (true);

COMMENT ON TABLE carrinho_abandonado IS 'Carrinhos que cliente montou mas não finalizou. TTL: 7 dias';
