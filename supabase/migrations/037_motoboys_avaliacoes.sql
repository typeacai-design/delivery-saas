-- =====================================================
-- Migration 037: Motoboys + Avaliações
-- Data: 2026-08-12
-- Sprint 5 — logística própria + feedback
-- =====================================================

-- 1) Tabela motoboys (entregadores da própria loja)
CREATE TABLE IF NOT EXISTS motoboys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  veiculo TEXT,
  placa TEXT,
  ativo BOOLEAN DEFAULT true,
  tipo_comissao TEXT DEFAULT 'percentual', -- 'percentual' | 'fixa'
  comissao_percent DECIMAL(5,2) DEFAULT 0, -- ex: 5.00 = 5%
  comissao_fixa DECIMAL(10,2) DEFAULT 0,   -- ex: 3.50 por entrega
  foto_url TEXT,
  total_entregas INTEGER DEFAULT 0,
  total_ganho DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motoboys_tenant ON motoboys(tenant_id);
ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motoboys do próprio tenant" ON motoboys
  FOR ALL USING (tenant_id = auth.uid());

COMMENT ON TABLE motoboys IS 'Entregadores próprios da loja (não usam plataforma externa)';
COMMENT ON COLUMN motoboys.tipo_comissao IS 'percentual (% do pedido) ou fixa (R$ por entrega)';

-- 2) Coluna motoboy_id em pedidos (atribuição)
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS motoboy_id UUID REFERENCES motoboys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motoboy_comissao DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_pedidos_motoboy ON pedidos(motoboy_id);

COMMENT ON COLUMN pedidos.motoboy_id IS 'Motoboy atribuído a este pedido';
COMMENT ON COLUMN pedidos.motoboy_comissao IS 'Comissão do motoboy congelada no momento da entrega';

-- 3) Trigger: ao mudar status para 'entregue' com motoboy atribuído,
--    computar comissão e atualizar total_entregas/total_ganho do motoboy.
CREATE OR REPLACE FUNCTION aplicar_comissao_motoboy()
RETURNS TRIGGER AS $$
DECLARE
  v_comissao DECIMAL(10,2);
BEGIN
  -- Só roda na transição para 'entregue'
  IF NEW.status = 'entregue' AND (OLD.status IS DISTINCT FROM 'entregue') THEN
    IF NEW.motoboy_id IS NOT NULL THEN
      -- Buscar config de comissão do motoboy
      SELECT
        CASE
          WHEN tipo_comissao = 'fixa' THEN comissao_fixa
          ELSE (COALESCE(NEW.valor_entrega, 0) * COALESCE(comissao_percent, 0)) / 100.0
        END
      INTO v_comissao
      FROM motoboys WHERE id = NEW.motoboy_id;

      IF v_comissao IS NOT NULL THEN
        NEW.motoboy_comissao := ROUND(v_comissao, 2);

        UPDATE motoboys
        SET
          total_entregas = COALESCE(total_entregas, 0) + 1,
          total_ganho = COALESCE(total_ganho, 0) + ROUND(v_comissao, 2)
        WHERE id = NEW.motoboy_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedido_aplicar_comissao ON pedidos;
CREATE TRIGGER trg_pedido_aplicar_comissao
BEFORE UPDATE ON pedidos
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION aplicar_comissao_motoboy();

-- 4) Tabela avaliações
CREATE TABLE IF NOT EXISTS avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  cliente_whatsapp TEXT,
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  aprovado BOOLEAN DEFAULT false,
  resposta_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_tenant ON avaliacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_aprovado ON avaliacoes(tenant_id, aprovado);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_nota ON avaliacoes(tenant_id, nota);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_pedido ON avaliacoes(pedido_id);

ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avaliações do próprio tenant" ON avaliacoes
  FOR ALL USING (tenant_id = auth.uid());

COMMENT ON TABLE avaliacoes IS 'Avaliações dos clientes (estrelas + comentário)';

-- 5) Cache: estrelas_media + estrelas_count em tenants.config
-- (computado on-read na API pra evitar trigger pesado)
