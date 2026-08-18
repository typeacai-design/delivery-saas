-- =====================================================
-- Migration 031: Campos do estilo InstaDelivery em produtos
-- Data: 2026-08-11
-- =====================================================
-- Adiciona campos novos ao produto pra ter uma tela
-- completa tipo InstaDelivery (criar/editar item).
-- Tudo opcional, defaults seguros.

ALTER TABLE produtos
  -- Identificação
  ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_externo TEXT,

  -- Pontos (sistema de fidelidade)
  ADD COLUMN IF NOT EXISTS pontos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pontos_promocionais INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_pontos_promo INTEGER,

  -- Adicional de Pedido (limite de compra + tempo)
  ADD COLUMN IF NOT EXISTS eh_adicional BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS adicional_limite_compra INTEGER,
  ADD COLUMN IF NOT EXISTS adicional_tempo_limite_min INTEGER,

  -- Disponibilidade por canal
  ADD COLUMN IF NOT EXISTS disponivel_mesa BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS disponivel_delivery BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS disponivel_retirada BOOLEAN DEFAULT true,

  -- Seção destaque
  ADD COLUMN IF NOT EXISTS secao_destaque BOOLEAN DEFAULT false,

  -- Metade / Fracionar
  ADD COLUMN IF NOT EXISTS pode_ser_metade BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS texto_metade TEXT,
  ADD COLUMN IF NOT EXISTS fracionar_item BOOLEAN DEFAULT false,

  -- Dias / Horários disponíveis (JSON arrays)
  ADD COLUMN IF NOT EXISTS dias_disponiveis INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6]::INTEGER[],
  ADD COLUMN IF NOT EXISTS horario_inicio TIME DEFAULT '00:00:00',
  ADD COLUMN IF NOT EXISTS horario_fim TIME DEFAULT '23:59:00',

  -- Limites de venda
  ADD COLUMN IF NOT EXISTS limite_vendas_dia INTEGER,
  ADD COLUMN IF NOT EXISTS limite_vendas_turno INTEGER,
  ADD COLUMN IF NOT EXISTS turno_id UUID,
  ADD COLUMN IF NOT EXISTS limite_vendas_horario INTEGER,

  -- Estoque
  ADD COLUMN IF NOT EXISTS controlar_estoque BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantidade_estoque INTEGER DEFAULT 0;

-- Índice pra busca por código externo
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_externo ON produtos(tenant_id, codigo_externo);

-- =====================================================
-- Comentários descritivos
-- =====================================================
COMMENT ON COLUMN produtos.ordem IS 'Ordem de exibição dentro da categoria';
COMMENT ON COLUMN produtos.codigo_externo IS 'Código interno do lojista (ex: 001)';
COMMENT ON COLUMN produtos.pontos IS 'Pontos de fidelidade por compra';
COMMENT ON COLUMN produtos.pontos_promocionais IS 'Pontos extras em promoção';
COMMENT ON COLUMN produtos.limite_pontos_promo IS 'Teto de uso de pontos promo';
COMMENT ON COLUMN produtos.eh_adicional IS 'Item é vendido como adicional de pedido';
COMMENT ON COLUMN produtos.adicional_limite_compra IS 'Qtd máxima por pedido (adicional)';
COMMENT ON COLUMN produtos.adicional_tempo_limite_min IS 'Tempo limite do adicional (min)';
COMMENT ON COLUMN produtos.disponivel_mesa IS 'Disponível para venda na mesa';
COMMENT ON COLUMN produtos.disponivel_delivery IS 'Disponível para delivery';
COMMENT ON COLUMN produtos.disponivel_retirada IS 'Disponível para retirada';
COMMENT ON COLUMN produtos.secao_destaque IS 'Destacar na seção principal do cardápio';
COMMENT ON COLUMN produtos.pode_ser_metade IS 'Permite escolher metade (ex: pizza)';
COMMENT ON COLUMN produtos.texto_metade IS 'Descrição do que é a metade';
COMMENT ON COLUMN produtos.fracionar_item IS 'Permite fracionar o item';
COMMENT ON COLUMN produtos.dias_disponiveis IS '0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb';
COMMENT ON COLUMN produtos.horario_inicio IS 'Horário de início de venda';
COMMENT ON COLUMN produtos.horario_fim IS 'Horário de fim de venda';
COMMENT ON COLUMN produtos.limite_vendas_dia IS 'Limite total de vendas por dia';
COMMENT ON COLUMN produtos.limite_vendas_turno IS 'Limite de vendas por turno';
COMMENT ON COLUMN produtos.turno_id IS 'Referência ao turno (futuro)';
COMMENT ON COLUMN produtos.limite_vendas_horario IS 'Limite de vendas por faixa de horário';
COMMENT ON COLUMN produtos.controlar_estoque IS 'Se true, baixa estoque ao vender';
COMMENT ON COLUMN produtos.quantidade_estoque IS 'Quantidade disponível em estoque';
