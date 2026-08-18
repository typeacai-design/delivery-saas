ALTER TABLE public.enderecos_entrega ADD COLUMN IF NOT EXISTS prazo_min integer;
ALTER TABLE public.enderecos_entrega ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.usuarios_loja DROP CONSTRAINT IF EXISTS usuarios_loja_role_check;
UPDATE public.usuarios_loja SET role='attendant' WHERE role NOT IN ('owner','manager','attendant','kitchen','motoboy','delivery');
ALTER TABLE public.usuarios_loja ADD CONSTRAINT usuarios_loja_role_check
  CHECK (role IN ('owner','manager','attendant','kitchen','motoboy','delivery'));

-- Tenants antigos usavam auth.uid() diretamente. Materializa o vínculo antes de
-- as APIs passarem a exigir associação ativa, sem reativar membros desabilitados.
INSERT INTO public.usuarios_loja (tenant_id,user_id,role,nome,email,ativo)
SELECT t.id,u.id,'owner',COALESCE(NULLIF(t.nome_responsavel,''),t.nome),COALESCE(u.email,t.email,''),true
FROM public.tenants t JOIN auth.users u ON u.id=t.id
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios_loja ul WHERE ul.tenant_id=t.id AND ul.user_id=u.id)
ON CONFLICT (tenant_id,user_id) DO NOTHING;

INSERT INTO public.usuarios_loja (tenant_id,user_id,role,nome,email,ativo)
SELECT ul.tenant_id,ul.user_id,
  CASE WHEN ul.role IN ('owner','manager','attendant') THEN ul.role ELSE 'attendant' END,
  COALESCE(NULLIF(t.nome_responsavel,''),t.nome),COALESCE(u.email,t.email,''),ul.ativo
FROM public.user_lojas ul JOIN public.tenants t ON t.id=ul.tenant_id JOIN auth.users u ON u.id=ul.user_id
ON CONFLICT (tenant_id,user_id) DO NOTHING;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.tenants GROUP BY lower(slug) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Migration 044: slugs duplicados (ignorando maiúsculas). Corrija-os antes de reaplicar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.enderecos_entrega GROUP BY tenant_id, lower(trim(bairro)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Migration 044: bairros duplicados no mesmo tenant. Consolide-os antes de reaplicar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE (latitude IS NULL) <> (longitude IS NULL) OR latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Migration 044: existem coordenadas de loja incompletas ou fora das faixas latitude [-90,90] e longitude [-180,180]. Corrija-as antes de reaplicar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.enderecos_entrega WHERE taxa IS NULL OR taxa < 0 OR taxa > 100000) THEN
    RAISE EXCEPTION 'Migration 044: existem taxas de bairro nulas, negativas ou acima de 100000. Corrija-as antes de reaplicar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.enderecos_entrega WHERE prazo_min IS NOT NULL AND (prazo_min < 1 OR prazo_min > 10080)) THEN
    RAISE EXCEPTION 'Migration 044: existem prazos de bairro fora da faixa de 1 a 10080 minutos. Corrija-os antes de reaplicar.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_lower_unique ON public.tenants (lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS enderecos_entrega_tenant_bairro_unique ON public.enderecos_entrega (tenant_id, lower(trim(bairro)));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenants_delivery_coordinates_valid') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_delivery_coordinates_valid CHECK (
      (latitude IS NULL AND longitude IS NULL) OR
      (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='enderecos_entrega_values_valid') THEN
    ALTER TABLE public.enderecos_entrega ADD CONSTRAINT enderecos_entrega_values_valid CHECK (
      taxa >= 0 AND taxa <= 100000 AND (prazo_min IS NULL OR prazo_min BETWEEN 1 AND 10080)
    );
  END IF;
END $$;

ALTER TABLE public.enderecos_entrega ENABLE ROW LEVEL SECURITY;
-- PostgreSQL combines permissive policies with OR. The legacy public policy
-- ignored `ativo`, so it must be removed before creating the restricted one.
DROP POLICY IF EXISTS "Cardapio publico ve areas de entrega" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Bairros ativos públicos" ON public.enderecos_entrega;
CREATE POLICY "Bairros ativos públicos" ON public.enderecos_entrega FOR SELECT TO anon USING (
  ativo=true AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.status='active')
);

-- Corrige a migration 042 para usuários administrativos vinculados a mais de uma loja.
DROP POLICY IF EXISTS "Categorias de produtos do tenant" ON public.categorias_produtos;
CREATE POLICY "Categorias de produtos do tenant" ON public.categorias_produtos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios_loja u WHERE u.user_id=auth.uid() AND u.tenant_id=categorias_produtos.tenant_id AND u.ativo=true))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios_loja u WHERE u.user_id=auth.uid() AND u.tenant_id=categorias_produtos.tenant_id AND u.ativo=true));
