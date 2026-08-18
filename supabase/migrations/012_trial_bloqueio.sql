-- Migration 012: Trial progressivo + bloqueio dia 10
-- Implementa a regra: grátis até R$ 2k/mês vendas. Se bater no mês anterior,
-- a partir do dia 10 do mês seguinte precisa pagar. Uma vez no ciclo, sempre paga.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS data_inicio_trial DATE DEFAULT CURRENT_DATE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS em_ciclo_cobranca BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS data_bloqueio TIMESTAMPTZ;

-- Função que verifica trial e bloqueia/desbloqueia tenant
CREATE OR REPLACE FUNCTION verificar_trial_tenant(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
  v_limite NUMERIC;
  v_em_ciclo BOOLEAN;
  v_faturamento_mes_anterior NUMERIC;
  v_dia_vencimento INTEGER;
  v_dia_atual INTEGER;
  v_mes_atual INTEGER;
BEGIN
  -- Buscar config
  SELECT (valor->>'limite_faturamento_mensal')::NUMERIC,
         (valor->>'dia_vencimento')::INTEGER
    INTO v_limite, v_dia_vencimento
    FROM saas_config WHERE chave = 'trial';

  v_dia_vencimento := COALESCE(v_dia_vencimento, 10);
  v_limite := COALESCE(v_limite, 2000);

  SELECT em_ciclo_cobranca INTO v_em_ciclo FROM tenants WHERE id = p_tenant_id;
  v_dia_atual := EXTRACT(DAY FROM NOW())::INTEGER;
  v_mes_atual := EXTRACT(MONTH FROM NOW())::INTEGER;

  -- Se já está em ciclo de cobrança, sempre bloqueia após dia 10 sem pagamento
  IF v_em_ciclo THEN
    -- Verifica se tem mensalidade do mês atual paga
    IF NOT EXISTS (
      SELECT 1 FROM mensalidades
      WHERE tenant_id = p_tenant_id
        AND mes = v_mes_atual
        AND status = 'pago'
    ) AND v_dia_atual > v_dia_vencimento THEN
      UPDATE tenants
        SET bloqueado = true,
            motivo_bloqueio = 'Mensalidade vencida. Pague para liberar.',
            data_bloqueio = NOW()
        WHERE id = p_tenant_id;
    ELSE
      UPDATE tenants SET bloqueado = false, motivo_bloqueio = NULL
        WHERE id = p_tenant_id AND bloqueado = true;
    END IF;
  ELSE
    -- Ainda em trial: verifica faturamento do mês ANTERIOR
    SELECT COALESCE(SUM(valor_total), 0) INTO v_faturamento_mes_anterior
      FROM pedidos
      WHERE tenant_id = p_tenant_id
        AND status NOT IN ('cancelado', 'recusado')
        AND EXTRACT(MONTH FROM created_at) = v_mes_atual - 1
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    -- Se bateu R$ 2k no mês anterior E já passou dia 10, entra em ciclo e bloqueia
    IF v_faturamento_mes_anterior >= v_limite AND v_dia_atual > v_dia_vencimento THEN
      UPDATE tenants
        SET em_ciclo_cobranca = true,
            bloqueado = true,
            motivo_bloqueio = 'Faturamento do mês anterior ultrapassou R$ ' || v_limite::TEXT || '. Mensalidade obrigatória a partir deste mês.',
            data_bloqueio = NOW()
        WHERE id = p_tenant_id;
    ELSE
      UPDATE tenants SET bloqueado = false, motivo_bloqueio = NULL
        WHERE id = p_tenant_id AND bloqueado = true;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN tenants.em_ciclo_cobranca IS 'Se true, lojista entrou no ciclo de cobrança e paga mensalidade fixa todo mês';
COMMENT ON COLUMN tenants.bloqueado IS 'Se true, dashboard fica bloqueado até admin liberar pagamento';
