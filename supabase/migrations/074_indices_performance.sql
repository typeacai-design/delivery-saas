-- Migration 074: Índices de performance para queries frequentes
-- OBJETIVO: Acelerar queries críticas sem mudar comportamento
-- SEGURO: Apenas CREATE INDEX (não altera dados, não impacta leitura)

-- Verificar indices existentes primeiro
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  -- Contar indices atuais na tabela pedidos
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'pedidos';
  RAISE NOTICE 'Indices atuais em pedidos: %', idx_count;
END $$;

-- ============================================================
-- 1. Índice para busca de pedidos por tenant + status (queries do dashboard)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_status_created
  ON pedidos (tenant_id, status, created_at DESC);

-- ============================================================
-- 2. Índice para busca de pedidos por cliente (whatsapp) dentro do tenant
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_whatsapp
  ON pedidos (tenant_id, cliente_whatsapp)
  WHERE cliente_whatsapp IS NOT NULL;

-- ============================================================
-- 3. Índice para movimentações por tenant + data (relatórios financeiros)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tenant_data
  ON movimentacoes_financeiras (tenant_id, data DESC);

-- ============================================================
-- 4. Índice para avalições por tenant + aprovado (cardápio público)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_avaliacoes_tenant_aprovado
  ON avaliacoes (tenant_id, created_at DESC)
  WHERE aprovado = true;

-- ============================================================
-- 5. Índice para clientes ativos por tenant (CRM)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_ativo
  ON clientes (tenant_id, nome)
  WHERE ativo = true;

-- Relatorio final
DO $$
DECLARE
  total_idx INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_idx
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename IN ('pedidos', 'movimentacoes_financeiras', 'avaliacoes', 'clientes');
  RAISE NOTICE 'Migration 074 aplicada: 5 indices de performance criados';
END $$;
