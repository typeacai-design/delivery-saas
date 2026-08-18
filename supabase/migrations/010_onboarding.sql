-- Migration 010: Onboarding
-- Adiciona colunas para controlar o wizard de onboarding

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN tenants.onboarding_completed IS 'Se true, lojista completou o wizard inicial e pode usar o sistema';
COMMENT ON COLUMN tenants.onboarding_step IS 'Step atual do wizard (0-4)';

-- Função para garantir tenant inicializa onboarding_step
CREATE OR REPLACE FUNCTION iniciar_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.onboarding_completed IS NULL THEN
    NEW.onboarding_completed := false;
  END IF;
  IF NEW.onboarding_step IS NULL THEN
    NEW.onboarding_step := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_iniciar_onboarding ON tenants;
CREATE TRIGGER trigger_iniciar_onboarding
  BEFORE INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION iniciar_onboarding();
