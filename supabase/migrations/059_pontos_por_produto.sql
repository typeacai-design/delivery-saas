-- =====================================================
-- Migration 059: Corrigir pontos de fidelidade por produto
-- Data: 2026-09-03
-- =====================================================

-- Nova função de métricas que usa pontos por produto
CREATE OR REPLACE FUNCTION atualizar_metricas_cliente()
RETURNS TRIGGER AS $$
DECLARE
  v_telefone TEXT;
  v_tenant_id UUID;
  v_cliente_id UUID;
  v_cfg_fidelidade JSONB;
  v_pontos INTEGER;
  v_cashback DECIMAL(10,2);
  v_fidelidade_tipo TEXT;
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
  v_fidelidade_tipo := COALESCE(v_cfg_fidelidade->>'fidelidade_tipo', 'por_valor');

  IF v_cfg_fidelidade IS NOT NULL THEN
    -- Se fidelidade está ativa
    IF (v_cfg_fidelidade->>'fidelidade_ativo')::BOOLEAN = true THEN
      -- Verificar o tipo de pontuação configurado
      IF v_fidelidade_tipo = 'por_produto' THEN
        -- Pontos por produto: somar pontos dos itens (quantidade * pontos do item)
        SELECT COALESCE(SUM(
          COALESCE(pi.quantidade, 1) * COALESCE(pi.pontos, 0)
        ), 0) INTO v_pontos
        FROM pedido_itens pi
        WHERE pi.pedido_id = NEW.id;

        -- Se não encontrou pontos, fallback para pontos por valor
        IF v_pontos = 0 THEN
          v_pontos := FLOOR(
            COALESCE(NEW.valor_subtotal, 0) *
            COALESCE((v_cfg_fidelidade->>'pontos_por_real')::NUMERIC, 0)
          );
        END IF;
      ELSE
        -- Pontos por valor gasto (comportamento padrão)
        v_pontos := FLOOR(
          COALESCE(NEW.valor_subtotal, 0) *
          COALESCE((v_cfg_fidelidade->>'pontos_por_real')::NUMERIC, 0)
        );
      END IF;
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

-- Recriar trigger
DROP TRIGGER IF EXISTS trg_pedido_atualiza_cliente ON pedidos;
CREATE TRIGGER trg_pedido_atualiza_cliente
AFTER INSERT OR UPDATE OF status, valor_total ON pedidos
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM 'cancelado')
EXECUTE FUNCTION atualizar_metricas_cliente();
