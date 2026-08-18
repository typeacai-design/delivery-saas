-- Migration 018: Sistema de tickets de suporte
-- Lojista abre ticket, admin responde

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  categoria TEXT DEFAULT 'duvida' CHECK (categoria IN ('bug', 'duvida', 'billing', 'sugestao')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  assunto TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido', 'fechado')),
  resposta_admin TEXT,
  respondido_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status) WHERE status NOT IN ('fechado', 'resolvido');

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lojista vê seus tickets" ON tickets FOR ALL USING (tenant_id = auth.uid());
CREATE POLICY "Admin gerencia todos tickets" ON tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'ranieryrick4@gmail.com')
  );

COMMENT ON TABLE tickets IS 'Tickets de suporte entre lojista e admin';
