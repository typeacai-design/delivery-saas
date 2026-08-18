-- Migration 026: bucket 'produtos' para imagens de produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: lojista pode upload apenas na própria pasta (seu user.id)
CREATE POLICY "Lojista upa suas próprias imagens" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'produtos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Lojista deleta suas próprias imagens" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'produtos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- SELECT público (bucket é public)
CREATE POLICY "Produtos são públicos" ON storage.objects
  FOR SELECT USING (bucket_id = 'produtos');
