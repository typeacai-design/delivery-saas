-- Migration 030: coluna onboarding_completed em tenants
-- Estava faltando — query em tenants falhava com "column does not exist"

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;