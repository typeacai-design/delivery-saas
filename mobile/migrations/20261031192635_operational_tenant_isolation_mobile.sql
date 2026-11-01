BEGIN;
GRANT UPDATE (tempo_preparo_extra_minutos) ON TABLE public.tenants TO authenticated;
ALTER TABLE public.sessoes_mesa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operacao acessa sessoes da propria loja" ON public.sessoes_mesa FOR ALL TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager','attendant']::text[])) WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager','attendant']::text[]));
ALTER TABLE public.dias_pico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores acessam picos da propria loja" ON public.dias_pico FOR ALL TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']::text[])) WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']::text[]));
COMMIT;
