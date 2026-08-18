-- Migration 041: imagens de identidade visual e complementos do cardapio.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_path text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS banner_path text;
ALTER TABLE public.complementos ADD COLUMN IF NOT EXISTS imagem_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cardapio-assets', 'cardapio-assets', true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('complementos', 'complementos', true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Lojista gerencia assets do cardapio" ON storage.objects;
CREATE POLICY "Lojista gerencia assets do cardapio" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'cardapio-assets' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'cardapio-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Assets do cardapio sao publicos" ON storage.objects;
CREATE POLICY "Assets do cardapio sao publicos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'cardapio-assets');

DROP POLICY IF EXISTS "Lojista gerencia imagens de complementos" ON storage.objects;
CREATE POLICY "Lojista gerencia imagens de complementos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'complementos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'complementos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Imagens de complementos sao publicas" ON storage.objects;
CREATE POLICY "Imagens de complementos sao publicas" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'complementos');
