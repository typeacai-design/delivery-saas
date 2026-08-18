-- Migration 013: Histórico de status do pedido
-- Trigger automático registra cada mudança de status do pedido

CREATE TABLE IF NOT EXISTS pedido_status_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  observacao TEXT,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_historico_pedido ON pedido_status_historico(pedido_id, criado_em DESC);

ALTER TABLE pedido_status_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver histórico do próprio pedido" ON pedido_status_historico
  FOR SELECT USING (pedido_id IN (SELECT id FROM pedidos WHERE tenant_id = auth.uid()));

CREATE POLICY "Inserir histórico" ON pedido_status_historico
  FOR INSERT WITH CHECK (pedido_id IN (SELECT id FROM pedidos WHERE tenant_id = auth.uid()));

-- Função trigger para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION criar_historico_status()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO pedido_status_historico (pedido_id, status, criado_por)
    VALUES (NEW.id, NEW.status, NEW.criado_por);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO pedido_status_historico (pedido_id, status, criado_por)
    VALUES (NEW.id, NEW.status, NEW.criado_por);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_historico_status ON pedidos;
CREATE TRIGGER trigger_historico_status
  AFTER INSERT OR UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION criar_historico_status();

COMMENT ON TABLE pedido_status_historico IS 'Timeline de mudanças de status do pedido (criado automaticamente por trigger)';
