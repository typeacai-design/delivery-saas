-- Migration 090: Atualizar calcular_tempo_preparo para considerar dias recorrentes
-- Executado em: 2026-09-10

CREATE OR REPLACE FUNCTION calcular_tempo_preparo(p_tempo_base INTEGER, p_tenant_id UUID, p_data TIMESTAMPTZ)
RETURNS INTEGER AS $$
DECLARE
  v_extra INTEGER := 0;
  v_ativo BOOLEAN;
  v_global INTEGER := 0;
  v_dia_semana TEXT;
  v_dow INTEGER;
BEGIN
  -- Tempo extra global (tenant) - aplicado em todos os dias com pico configurado
  SELECT tempo_preparo_extra_minutos INTO v_global FROM tenants WHERE id = p_tenant_id;
  IF v_global IS NULL THEN v_global := 0; END IF;

  -- 1) Verifica data específica (maior prioridade)
  SELECT tempo_extra_minutos INTO v_extra FROM dias_pico
  WHERE tenant_id = p_tenant_id AND data = p_data::DATE AND dia_semana IS NULL
  LIMIT 1;
  IF v_extra IS NOT NULL THEN
    RETURN p_tempo_base + v_extra;
  END IF;

  -- 2) Verifica dia recorrente da semana (seg/ter/...)
  -- 0 = Domingo, 1 = Segunda, ... 6 = Sábado (Postgres DOW)
  v_dow := EXTRACT(DOW FROM p_data)::INTEGER;
  v_dia_semana := CASE v_dow
    WHEN 1 THEN 'seg' WHEN 2 THEN 'ter' WHEN 3 THEN 'qua' WHEN 4 THEN 'qui'
    WHEN 5 THEN 'sex' WHEN 6 THEN 'sab' WHEN 0 THEN 'dom'
  END;

  SELECT tempo_extra_minutos INTO v_extra FROM dias_pico
  WHERE tenant_id = p_tenant_id AND dia_semana = v_dia_semana AND data IS NULL
  LIMIT 1;
  IF v_extra IS NOT NULL THEN
    RETURN p_tempo_base + v_extra;
  END IF;

  -- 3) Sem pico configurado
  RETURN p_tempo_base;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
