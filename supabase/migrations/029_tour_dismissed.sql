-- Migration 029: flag pra tour pós-onboarding
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tour_dismissed BOOLEAN DEFAULT FALSE;
