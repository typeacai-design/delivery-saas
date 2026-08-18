-- Migration 020: Mesas (gestão de salão do restaurante)
-- Opt-in sempre disponível (lojista liga/desliga via config)

CREATE TABLE IF NOT EXISTS mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nome TEXT,
  capacidade INTEGER DEFAULT 4,
  status TEXT DEFAULT 'livre' CHECK (status IN ('livre', 'ocupada', 'reservada', 'manutencao')),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_mesas_tenant ON mesas(tenant_id);

ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver mesas próprias" ON mesas FOR ALL USING (tenant_id = auth.uid());

-- Mesas habilitadas por tenant (config)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mesas_habilitadas BOOLEAN DEFAULT false;

COMMENT ON TABLE mesas IS 'Mesas do salão do restaurante (opt-in via tenants.mesas_habilitadas)';
