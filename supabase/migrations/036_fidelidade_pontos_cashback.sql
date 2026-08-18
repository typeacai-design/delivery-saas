-- =====================================================
-- Migration 036: Fidelidade + Cashback + Visitantes
-- Data: 2026-08-11
-- Sprint 4 — Marketing
-- =====================================================

-- 1) Saldo de pontos por cliente
CREATE TABLE IF NOT EXISTS cliente_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  pontos_saldo INTEGER DEFAULT 0,
  pontos_acumulados_total INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_pontos_tenant ON cliente_pontos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cliente_pontos_cliente ON cliente_pontos(cliente_id);

ALTER TABLE cliente_pontos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pontos visíveis ao tenant" ON cliente_pontos
  FOR ALL USING (tenant_id = auth.uid());

COMMENT ON TABLE cliente_pontos IS 'Saldo de pontos de fidelidade por cliente (por tenant)';
COMMENT ON COLUMN cliente_pontos.pontos_saldo IS 'Saldo atual resgatável';
COMMENT ON COLUMN cliente_pontos.pontos_acumulados_total IS 'Total histórico acumulado (não decai)';

-- 2) Saldo de cashback no cliente
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS saldo_cashback DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN clientes.saldo_cashback IS 'Cashback acumulado (em R$)';

-- 3) Page views (visitantes)
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT,
  path TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_tenant_data ON page_views(tenant_id, created_at DESC);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Views visíveis ao tenant" ON page_views
  FOR ALL USING (tenant_id = auth.uid());

COMMENT ON TABLE page_views IS 'Page views do cardápio público (analytics)';

-- 4) Atualizar trigger de pedido pra conceder pontos + cashback
CREATE OR REPLACE FUNCTION atualizar_metricas_cliente()
RETURNS TRIGGER AS $$
DECLARE
  v_telefone TEXT;
  v_tenant_id UUID;
  v_cliente_id UUID;
  v_cfg_fidelidade JSONB;
  v_pontos INTEGER;
  v_cashback DECIMAL(10,2);
  v_pontos_produto INTEGER;
BEGIN
  v_tenant_id := NEW.tenant_id;
  v_telefone := NEW.cliente_whatsapp;

  IF v_telefone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar config de fidelidade do tenant
  SELECT config INTO v_cfg_fidelidade
  FROM tenants WHERE id = v_tenant_id;
  v_pontos := 0;
  v_cashback := 0;

  IF v_cfg_fidelidade IS NOT NULL THEN
    -- Pontos por valor gasto
    IF (v_cfg_fidelidade->>'fidelidade_ativo')::BOOLEAN = true THEN
      v_pontos := FLOOR(
        COALESCE(NEW.valor_subtotal, 0) *
        COALESCE((v_cfg_fidelidade->>'pontos_por_real')::NUMERIC, 0)
      );
    END IF;
    -- Cashback %
    IF (v_cfg_fidelidade->>'cashback_ativo')::BOOLEAN = true THEN
      v_cashback := ROUND(
        COALESCE(NEW.valor_total, 0) *
        COALESCE((v_cfg_fidelidade->>'cashback_percent')::NUMERIC, 0) / 100.0,
        2
      );
    END IF;
  END IF;

  -- Encontrar ou criar cliente
  SELECT id INTO v_cliente_id
  FROM clientes
  WHERE tenant_id = v_tenant_id AND telefone = v_telefone
  LIMIT 1;

  IF v_cliente_id IS NOT NULL THEN
    UPDATE clientes
    SET
      ltv = COALESCE((
        SELECT SUM(valor_total) FROM pedidos
        WHERE tenant_id = v_tenant_id
          AND cliente_whatsapp = v_telefone
          AND status NOT IN ('cancelado')
      ), 0),
      ultimo_pedido_em = NEW.created_at,
      primeiro_pedido_em = COALESCE(clientes.primeiro_pedido_em, NEW.created_at),
      total_pedidos = COALESCE((
        SELECT COUNT(*) FROM pedidos
        WHERE tenant_id = v_tenant_id
          AND cliente_whatsapp = v_telefone
          AND status NOT IN ('cancelado')
      ), 1),
      saldo_cashback = COALESCE(clientes.saldo_cashback, 0) + v_cashback
    WHERE id = v_cliente_id;

    -- Atualizar pontos
    INSERT INTO cliente_pontos (tenant_id, cliente_id, pontos_saldo, pontos_acumulados_total, updated_at)
    VALUES (v_tenant_id, v_cliente_id, v_pontos, v_pontos, NOW())
    ON CONFLICT (tenant_id, cliente_id) DO UPDATE SET
      pontos_saldo = cliente_pontos.pontos_saldo + EXCLUDED.pontos_saldo,
      pontos_acumulados_total = cliente_pontos.pontos_acumulados_total + EXCLUDED.pontos_acumulados_total,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Substituir trigger existente
DROP TRIGGER IF EXISTS trg_pedido_atualiza_cliente ON pedidos;
CREATE TRIGGER trg_pedido_atualiza_cliente
AFTER INSERT OR UPDATE OF status, valor_total ON pedidos
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM 'cancelado')
EXECUTE FUNCTION atualizar_metricas_cliente();
