-- Migration 088: Adicionar pedidos.tipo_pedido
-- Executado em: 2026-09-10
-- Adiciona coluna que distingue: delivery (entrega por motoboy) | mesa (pedido de mesa no salão) | retirada (cliente busca no balcão)

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tipo_pedido TEXT DEFAULT 'delivery'
    CHECK (tipo_pedido IN ('delivery', 'mesa', 'retirada'));

COMMENT ON COLUMN pedidos.tipo_pedido IS 'delivery = motoboy entrega | mesa = atendimento no salão (vinculado a sessoes_mesa) | retirada = cliente busca no balcão';

-- Backfill: pedidos com sessao_mesa_id != null são tipo 'mesa'
UPDATE pedidos
SET tipo_pedido = 'mesa'
WHERE sessao_mesa_id IS NOT NULL
  AND tipo_pedido IS DISTINCT FROM 'mesa';

-- Backfill: pedidos onde tipo_entrega = 'retirada' viram tipo_pedido = 'retirada' (se ainda não foram marcados como mesa)
UPDATE pedidos
SET tipo_pedido = 'retirada'
WHERE tipo_entrega = 'retirada'
  AND sessao_mesa_id IS NULL
  AND tipo_pedido IS DISTINCT FROM 'retirada';

-- Demais ficam 'delivery' (default)
UPDATE pedidos
SET tipo_pedido = 'delivery'
WHERE tipo_pedido IS NULL;

-- Índice composto para queries da cozinha/lojista que filtram por tipo
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_tipo_status
  ON pedidos(tenant_id, tipo_pedido, status, data_criacao DESC);
