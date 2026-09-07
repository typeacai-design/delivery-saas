-- Migration 073: Reverter pago de pedidos com valor_total = 0
-- OBJETIVO: Pedidos com valor zero não devem ser marcados como pagos
-- MOTIVO: Pedido 00026/26 tem valor_total=0 e subtotal=31 com desconto=31
--          (cupom de 100% zerou o total). Marcar pago=true não faz sentido.

-- Desabilitar trigger de validacao para fazer a correcao administrativa
ALTER TABLE pedidos DISABLE TRIGGER trg_validar_atualizacao_operacional_pedido;

-- Reverter pago=true para pedidos com valor_total = 0
-- Manter o status (entregue/cancelado) intacto
UPDATE pedidos
SET
  pago = false,
  pago_em = NULL,
  pago_por = NULL,
  observacoes = COALESCE(
    observacoes || E'\n',
    ''
  ) || '[Correção automática] Pedido marcado como pago, mas valor_total é R$ 0,00 (cupom 100%). Pago revertido em ' || NOW()::timestamp::text
WHERE valor_total = 0
  AND pago = true;

-- Reabilitar trigger
ALTER TABLE pedidos ENABLE TRIGGER trg_validar_atualizacao_operacional_pedido;

-- Relatorio
DO $$
DECLARE
  total_revertidos INTEGER;
BEGIN
  GET DIAGNOSTICS total_revertidos = ROW_COUNT;
  RAISE NOTICE 'Migration 073 aplicada: % pedidos com valor_total=0 tiveram pago revertido', total_revertidos;
END $$;
