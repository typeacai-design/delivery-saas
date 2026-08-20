-- Migration: 051_habilitar_realtime_pedidos
-- Data: 2026-08-20
-- Habilitar Realtime para receber pedidos instantaneamente no painel do lojista

-- Adicionar tabela pedidos à publication do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
