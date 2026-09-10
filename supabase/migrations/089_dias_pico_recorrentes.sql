-- Migration 089: Adicionar dia_semana em dias_pico para recorrência semanal
-- Executado em: 2026-09-10

ALTER TABLE dias_pico ADD COLUMN IF NOT EXISTS dia_semana TEXT
  CHECK (dia_semana IS NULL OR dia_semana IN ('seg','ter','qua','qui','sex','sab','dom'));

COMMENT ON COLUMN dias_pico.dia_semana IS 'Se setado, este é um pico recorrente semanal (NULL = data específica pontual)';

-- Permite múltiplos dias recorrentes no mesmo tenant (ex: sáb E dom)
DROP INDEX IF EXISTS dias_pico_tenant_data_key;
ALTER TABLE dias_pico DROP CONSTRAINT IF EXISTS dias_pico_tenant_data_key;

-- Garantir unicidade apenas quando data é específica
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dias_pico_tenant_data
  ON dias_pico(tenant_id, data)
  WHERE data IS NOT NULL;

-- Para recorrentes, garante 1 por dia da semana por tenant
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dias_pico_tenant_dia
  ON dias_pico(tenant_id, dia_semana)
  WHERE dia_semana IS NOT NULL;
