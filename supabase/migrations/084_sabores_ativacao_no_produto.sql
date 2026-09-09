-- The product opt-in is the single merchant action. Run after configuration validation.
-- No backfill: existing stores/products/orders remain unchanged until a product is saved.
CREATE OR REPLACE FUNCTION public.ativar_sabores_ao_salvar_produto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sabores_grupo_id IS NOT NULL THEN
    UPDATE public.tenants SET sabores_ativo=true
    WHERE id=NEW.tenant_id AND sabores_ativo IS DISTINCT FROM true;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ativar_sabores_ao_salvar_produto() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ativar_sabores_produto ON public.produtos;
CREATE TRIGGER ativar_sabores_produto
AFTER INSERT OR UPDATE OF sabores_grupo_id,sabores_maximo ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.ativar_sabores_ao_salvar_produto();
NOTIFY pgrst, 'reload schema';
