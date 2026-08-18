-- Migration 014: Retirada no balcão + Pedido agendado
-- Adiciona tipo_entrega (delivery|retirada) e agendamento_para

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tipo_entrega TEXT DEFAULT 'delivery'
    CHECK (tipo_entrega IN ('delivery', 'retirada'));

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS agendamento_para TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pedidos_agendamento ON pedidos(agendamento_para) WHERE agendamento_para IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_tipo_entrega ON pedidos(tipo_entrega);

COMMENT ON COLUMN pedidos.tipo_entrega IS 'delivery = entrega no endereço | retirada = cliente busca no balcão';
COMMENT ON COLUMN pedidos.agendamento_para IS 'Se preenchido, pedido é agendado para essa data/hora';
