-- Migration 028: UNIQUE em mensalidades(tenant_id, mes, ano) e colunas
-- necessárias pro upsert idempotente
ALTER TABLE mensalidades
  ADD CONSTRAINT mensalidades_tenant_mes_ano_unique UNIQUE (tenant_id, mes, ano);

ALTER TABLE mensalidades
  ALTER COLUMN data_vencimento SET NOT NULL;
