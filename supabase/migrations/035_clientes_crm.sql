-- =====================================================
-- Migration 035: Clientes CRM completo
-- Data: 2026-08-11
-- Sprint 3 — Meus Clientes
-- =====================================================

ALTER TABLE clientes
  -- Colunas básicas que faltavam
  ADD COLUMN IF NOT EXISTS total_pedidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_pedido_em TIMESTAMPTZ,
  -- Campos extras do CRM
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS opt_in_whatsapp BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ltv DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primeiro_pedido_em TIMESTAMPTZ;

-- Índice pra busca por telefone dentro do tenant
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_telefone ON clientes(tenant_id, telefone);

-- Índice pra ordenar por último pedido (top clientes)
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_ultimo ON clientes(tenant_id, ultimo_pedido_em DESC NULLS LAST);

COMMENT ON COLUMN clientes.email IS 'E-mail do cliente (opcional)';
COMMENT ON COLUMN clientes.observacoes IS 'Notas internas do lojista sobre o cliente';
COMMENT ON COLUMN clientes.tags IS 'Tags livres: vip, inadimplente,过敏, sem_gluten, etc';
COMMENT ON COLUMN clientes.ativo IS 'Cliente ativo = recebe campanhas, visível em relatórios';
COMMENT ON COLUMN clientes.opt_in_whatsapp IS 'Cliente autorizou receber mensagens WhatsApp';
COMMENT ON COLUMN clientes.ltv IS 'Lifetime value (soma valor_total dos pedidos confirmados)';
COMMENT ON COLUMN clientes.primeiro_pedido_em IS 'Quando o cliente fez o primeiro pedido (calculado automaticamente)';

-- Função pra atualizar LTV/primeiro pedido/último pedido automaticamente
CREATE OR REPLACE FUNCTION atualizar_metricas_cliente()
RETURNS TRIGGER AS $$
DECLARE
  v_telefone TEXT;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := NEW.tenant_id;
  v_telefone := NEW.cliente_whatsapp;

  IF v_telefone IS NULL THEN
    RETURN NEW;
  END IF;

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
    ), 1)
  WHERE tenant_id = v_tenant_id
    AND telefone = v_telefone;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedido_atualiza_cliente ON pedidos;
CREATE TRIGGER trg_pedido_atualiza_cliente
AFTER INSERT OR UPDATE OF status, valor_total ON pedidos
FOR EACH ROW
EXECUTE FUNCTION atualizar_metricas_cliente();
