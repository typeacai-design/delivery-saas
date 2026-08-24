-- Migration 055: Corrigir IDs de formas de pagamento
-- Os IDs estavam sendo salvos como 'credito'/'debito' mas o cardápio espera 'cartao_credito'/'cartao_debito'

-- Atualizar tenants com config mal formatada
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id, config FROM public.tenants LOOP
    IF t.config IS NOT NULL THEN
      -- Se tem 'credito' ou 'debito', migrar para 'cartao_credito'/'cartao_debito'
      IF t.config::jsonb ? 'credito' THEN
        t.config = jsonb_set(
          jsonb_set(t.config, '{cartao_credito}', t.config->'credito'),
          '{credito}',
          'null'::jsonb
        );
      END IF;
      IF t.config::jsonb ? 'debito' THEN
        t.config = jsonb_set(
          jsonb_set(t.config, '{cartao_debito}', t.config->'debito'),
          '{debito}',
          'null'::jsonb
        );
      END IF;

      UPDATE public.tenants SET config = t.config WHERE id = t.id;
    END IF;
  END LOOP;
END $$;

-- Verificar resultado
-- SELECT id, config->'formas_pagamento_aceitas' FROM public.tenants LIMIT 10;
