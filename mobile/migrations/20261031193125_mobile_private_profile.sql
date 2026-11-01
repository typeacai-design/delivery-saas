-- Explicit owner/manager RPCs avoid granting CPF, CNPJ or account-email columns
-- to every authenticated employee. No anonymous execution and no caller-selected table.
BEGIN;
CREATE OR REPLACE FUNCTION public.mobile_perfil_loja(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_active_tenant_role(p_tenant_id,ARRAY['owner','manager']::text[])
 OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active' AND NOT COALESCE(bloqueado,false)) THEN
  RAISE EXCEPTION 'Sem permissao' USING ERRCODE='42501';
 END IF;
 SELECT pg_catalog.jsonb_build_object('nome',t.nome,'cpf',t.cpf,'cnpj',t.cnpj,'categoria',t.categoria,
 'tipo_estabelecimento',t.tipo_estabelecimento,'logo_url',t.logo_url,'telefone',t.telefone,
 'endereco',t.endereco,'numero',t.numero,'cidade',t.cidade,'estado',t.estado,'bairro',t.bairro,
 'complemento',t.complemento,'cep',t.cep,'slug',t.slug,'email',t.email,'nome_responsavel',t.nome_responsavel,
 'created_at',t.created_at,'updated_at',t.updated_at) INTO result FROM public.tenants t WHERE t.id=p_tenant_id;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.mobile_salvar_perfil_loja(p_tenant_id uuid,p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_slug text;v_cpf text;v_cnpj text;v_nome text;i int;j int;s int;d int;
BEGIN
 -- The read RPC performs the same authenticated ownership/status/block checks.
 PERFORM public.mobile_perfil_loja(p_tenant_id);
 IF pg_catalog.jsonb_typeof(p_dados) IS DISTINCT FROM 'object' OR EXISTS(
  SELECT 1 FROM pg_catalog.jsonb_object_keys(p_dados) k WHERE k NOT IN
  ('nome','cpf','cnpj','categoria','telefone','endereco','numero','cidade','estado','slug')) THEN
  RAISE EXCEPTION 'Campos invalidos';
 END IF;
 v_slug=pg_catalog.lower(pg_catalog.btrim(COALESCE(p_dados->>'slug','')));
 v_nome=pg_catalog.btrim(COALESCE(p_dados->>'nome',''));
 IF v_nome='' OR pg_catalog.length(v_nome)>160 OR v_slug !~ '^[a-z0-9]{3,60}$'
 OR v_slug=ANY(ARRAY['admin','api','login','dashboard','cardapio','configuracoes','suporte','registro','wedelivery']) THEN
  RAISE EXCEPTION 'Nome ou link invalido';
 END IF;
 IF EXISTS(SELECT 1 FROM public.tenants WHERE pg_catalog.lower(slug)=v_slug AND id<>p_tenant_id) THEN
  RAISE EXCEPTION 'Esse link ja esta em uso';
 END IF;
 v_cpf=pg_catalog.regexp_replace(COALESCE(p_dados->>'cpf',''),'[^0-9]','','g');
 v_cnpj=pg_catalog.regexp_replace(COALESCE(p_dados->>'cnpj',''),'[^0-9]','','g');
 IF v_cpf<>'' THEN
  IF pg_catalog.length(v_cpf)<>11 OR v_cpf ~ '^([0-9])\1{10}$' THEN RAISE EXCEPTION 'CPF invalido';END IF;
  FOR j IN 9..10 LOOP
   s=0;FOR i IN 1..j LOOP s=s+pg_catalog.substr(v_cpf,i,1)::int*(j+2-i);END LOOP;
   d=(s*10)%11;IF d=10 THEN d=0;END IF;
   IF d<>pg_catalog.substr(v_cpf,j+1,1)::int THEN RAISE EXCEPTION 'CPF invalido';END IF;
  END LOOP;
 END IF;
 IF v_cnpj<>'' AND pg_catalog.length(v_cnpj)<>14 THEN RAISE EXCEPTION 'CNPJ invalido';END IF;
 UPDATE public.tenants SET nome=v_nome,cpf=NULLIF(v_cpf,''),cnpj=NULLIF(v_cnpj,''),
 categoria=NULLIF(p_dados->>'categoria',''),tipo_estabelecimento=NULLIF(p_dados->>'categoria',''),
 telefone=NULLIF(pg_catalog.left(pg_catalog.regexp_replace(COALESCE(p_dados->>'telefone',''),'[^0-9]','','g'),15),''),
 endereco=NULLIF(pg_catalog.left(pg_catalog.btrim(COALESCE(p_dados->>'endereco','')),300),''),
 numero=NULLIF(pg_catalog.left(COALESCE(p_dados->>'numero',''),30),''),
 cidade=NULLIF(pg_catalog.left(COALESCE(p_dados->>'cidade',''),100),''),
 estado=NULLIF(pg_catalog.upper(pg_catalog.left(COALESCE(p_dados->>'estado',''),2)),''),slug=v_slug
 WHERE id=p_tenant_id;
 RETURN pg_catalog.jsonb_build_object('ok',true,'slug',v_slug);
END $$;
REVOKE ALL ON FUNCTION public.mobile_perfil_loja(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mobile_salvar_perfil_loja(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mobile_perfil_loja(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_salvar_perfil_loja(uuid,jsonb) TO authenticated;
COMMIT;

