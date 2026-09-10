-- Migration 087: Migracao do sistema de override de loja para novo formato
-- Executado em: 2026-09-09

-- Remove overrides expirados do config antigo (mantem apenas os validos)
UPDATE tenants
SET config = config - 'loja_aberta' - 'loja_aberta_override_until'
WHERE config ? 'loja_aberta' OR config ? 'loja_aberta_override_until';

-- Comentario na nova coluna
COMMENT ON COLUMN tenants.loja_aberta_manual IS 'NULL = segue horario automatico, TRUE = forca aberta (fecha auto no proximo horario programado), FALSE = forca fechada (abre auto no proximo horario programado)';