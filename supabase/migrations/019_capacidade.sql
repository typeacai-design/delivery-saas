-- Migration 019: Capacidade de produção por turno
-- Lojista define quantos pedidos aguenta por turno (ex: almoço 10-30 pedidos)

CREATE TABLE IF NOT EXISTS turnos_capacidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dias_semana INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  capacidade_maxima INTEGER NOT NULL DEFAULT 10,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_capacidade_tenant ON turnos_capacidade(tenant_id);

ALTER TABLE turnos_capacidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver capacidade própria" ON turnos_capacidade FOR ALL USING (tenant_id = auth.uid());

COMMENT ON TABLE turnos_capacidade IS 'Capacidade máxima de pedidos por turno (ex: almoço 11-14h, jantar 18-22h)';
