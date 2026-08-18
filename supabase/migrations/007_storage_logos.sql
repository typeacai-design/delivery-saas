-- ================================================
-- Migration 007: Supabase Storage para logos
-- ================================================
-- Cria bucket público "logos" se não existir.
-- Lojistas salvam a logo em: logos/{tenant_id}/logo.{ext}

-- O bucket é criado via API/SDK, não via SQL.
-- Esta migration é apenas documentação do caminho.

-- A URL pública da logo segue o padrão:
-- https://{SUPABASE_URL}/storage/v1/object/public/logos/{tenant_id}/logo.{ext}

-- Para subir a logo, usar o SDK:
-- supabase.storage.from('logos').upload(`${userId}/logo.png`, file, { upsert: true })
