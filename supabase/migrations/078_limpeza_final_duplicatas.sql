-- Migration 078: Limpeza final e definitiva de duplicatas em TODOS os tenants
-- OBJETIVO: Garantir ZERO duplicatas ativas em qualquer tenant
-- SEGURO: Apenas desativa duplicatas, preservando auditoria

-- Para cada (tenant_id, telefone), manter apenas o cliente mais antigo ativo
WITH duplicados_para_desativar AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')
      ORDER BY created_at ASC
    ) as rn
  FROM clientes
  WHERE ativo = true
    AND telefone IS NOT NULL
    AND LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')) >= 10
)
UPDATE clientes
SET ativo = false,
    observacoes = COALESCE(observacoes || E'\n', '') ||
                  '[limpeza final migration 078 em ' || NOW()::timestamp::text || ']'
WHERE id IN (
  SELECT id FROM duplicados_para_desativar WHERE rn > 1
);

-- Relatorio
DO $$
DECLARE
  total_restantes INTEGER;
  total_desativados INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_restantes
  FROM (
    SELECT tenant_id, REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') as tel
    FROM clientes
    WHERE ativo = true
      AND telefone IS NOT NULL
    GROUP BY tenant_id, REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')
    HAVING COUNT(*) > 1
  ) sub;

  GET DIAGNOSTICS total_desativados = ROW_COUNT;

  RAISE NOTICE 'Migration 078 aplicada';
  RAISE NOTICE 'Duplicatas desativadas nesta limpeza: %', total_desativados;
  RAISE NOTICE 'Grupos duplicados restantes: %', total_restantes;
END $$;
