-- Migration 047: consolida o isolamento multi-tenant e remove atalhos de admin.
--
-- O administrador da plataforma acessa estas tabelas exclusivamente por APIs
-- server-side autenticadas que usam service_role. Nenhuma policy baseada em
-- e-mail e nenhuma policy aberta ao papel PUBLIC e necessaria para esse acesso.

-- SECURITY DEFINER evita recursao infinita quando uma policy de usuarios_loja
-- precisa consultar a propria tabela. O uid nunca e recebido do cliente.
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.usuarios_loja AS membership
    WHERE membership.tenant_id = p_tenant_id
      AND membership.user_id = auth.uid()
      AND membership.ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_active_tenant_role(p_tenant_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.usuarios_loja AS membership
    WHERE membership.tenant_id = p_tenant_id
      AND membership.user_id = auth.uid()
      AND membership.ativo = true
      AND membership.role = ANY (p_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_tenant_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_active_tenant_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_tenant_role(uuid, text[]) TO authenticated;

-- Tenants: remove inclusive policies desconhecidas (inclusive a encontrada em
-- producao, "Admin full access tenants") antes de reconstruir a lista fechada.
DO $migration$
DECLARE policy_row record;
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'tenants'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants', policy_row.policyname);
    END LOOP;
  END IF;
END
$migration$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalogo publico ve lojas ativas"
  ON public.tenants FOR SELECT TO anon
  USING (status = 'active');
CREATE POLICY "Membros ativos veem a propria loja"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(id));
CREATE POLICY "Gestores atualizam a propria loja"
  ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_active_tenant_role(id, ARRAY['owner','manager']))
  WITH CHECK (public.has_active_tenant_role(id, ARRAY['owner','manager']));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.tenants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.tenants FROM authenticated;
REVOKE SELECT ON TABLE public.tenants FROM anon;
GRANT SELECT (id, nome, slug, logo_url, cor_principal, telefone, cidade, estado,
  bairro, endereco, numero, complemento, tipo_estabelecimento, categoria,
  logo_path, banner_url, banner_path, latitude, longitude, status)
  ON TABLE public.tenants TO anon;
REVOKE SELECT ON TABLE public.tenants FROM authenticated;
GRANT SELECT (id,nome,slug,config,logo_url,cor_principal,created_at,updated_at,status,cidade,estado,bairro,endereco,numero,complemento,tipo_estabelecimento,onboarding_completed,mesas_habilitadas,tour_dismissed,logo_path,banner_url,banner_path,latitude,longitude) ON public.tenants TO authenticated;
GRANT UPDATE (
  nome, slug, cnpj, config, logo_url, cor_principal, updated_at, email, numero,
  cpf, nome_responsavel, cidade, telefone, categoria, estado, bairro, endereco,
  complemento, tipo_estabelecimento, data_nascimento, onboarding_completed,
  mesas_habilitadas, tour_dismissed,
  logo_path, banner_url, banner_path, latitude, longitude
) ON TABLE public.tenants TO authenticated;

-- usuarios_loja: regras sem subconsulta RLS recursiva. A criacao inicial e os
-- convites passam pelas APIs/RPC service_role; membros nao podem se promover.
DO $migration$
DECLARE policy_row record;
BEGIN
  IF to_regclass('public.usuarios_loja') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'usuarios_loja'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.usuarios_loja', policy_row.policyname);
    END LOOP;
  END IF;
END
$migration$;

ALTER TABLE public.usuarios_loja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores veem a equipe" ON public.usuarios_loja FOR SELECT TO authenticated
  USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']));
CREATE POLICY "Operacionais veem o proprio vinculo" ON public.usuarios_loja FOR SELECT TO authenticated
  USING (user_id=auth.uid() AND ativo=true);
REVOKE ALL ON TABLE public.usuarios_loja FROM anon, authenticated;
GRANT SELECT (id,tenant_id,user_id,nome,email,role,ativo,created_at) ON public.usuarios_loja TO authenticated;
-- user_lojas e um indice legado de lojas do usuario. Ele nao concede associacao
-- e nao pode ser alterado diretamente pelo cliente.
DO $migration$
DECLARE policy_row record;
BEGIN
  IF to_regclass('public.user_lojas') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_lojas'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_lojas', policy_row.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.user_lojas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Usuarios veem os proprios vinculos legados" ON public.user_lojas FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'REVOKE ALL ON TABLE public.user_lojas FROM anon';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_lojas FROM authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.user_lojas TO authenticated';
  END IF;
END
$migration$;

-- Tabelas com tenant_id: substitui as policies permissivas/legadas por uma
-- unica regra de associacao ativa. Pedidos e bairros ficam com as regras mais
-- granulares da migration 046 e sao tratados separadamente abaixo.
DO $migration$
DECLARE
  table_name text;
  policy_row record;
  tenant_tables constant text[] := ARRAY[
    'categorias','produtos','complementos','clientes','insumos','cupons',
    'categorias_complementos','consentimentos_lgpd','despesas','tickets',
    'turnos_capacidade',
    'mesas','carrinho_abandonado','produto_ingredientes','cliente_pontos',
    'page_views','motoboys','avaliacoes','embaixadores','indicacoes_embaixador',
    'campanhas_sorteio','cupons_sorteio'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN CONTINUE; END IF;
    FOR policy_row IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      $policy$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']))$policy$,
      'Gestores leem dados do tenant', table_name
    );
    EXECUTE format(
      $policy$CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager'])) WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']))$policy$,
      'Gestores administram dados do tenant', table_name
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
  END LOOP;
END
$migration$;

-- Papeis operacionais recebem somente os conjuntos necessarios ao trabalho.
CREATE POLICY "Operacao le categorias" ON public.categorias FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['attendant','kitchen']));
CREATE POLICY "Operacao le produtos" ON public.produtos FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['attendant','kitchen']));
CREATE POLICY "Operacao le complementos" ON public.complementos FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['attendant','kitchen']));
CREATE POLICY "Operacao le listas de complementos" ON public.categorias_complementos FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['attendant','kitchen']));
CREATE POLICY "Atendimento le cupons" ON public.cupons FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['attendant']));
CREATE POLICY "Operacao le mesas" ON public.mesas FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['attendant']));
CREATE POLICY "Entrega le motoboys" ON public.motoboys FOR SELECT TO authenticated USING (public.has_active_tenant_role(tenant_id, ARRAY['delivery','motoboy']));
-- Dados financeiros e auditoria exigem privilegios menores que as tabelas
-- operacionais: o lojista pode consultar e criar registros pendentes, mas nao
-- pode marcar a propria mensalidade/PIX como pago nem reescrever o historico.
DO $migration$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='mensalidades' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensalidades', policy_row.policyname);
  END LOOP;
  ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Membros ativos veem mensalidades" ON public.mensalidades FOR SELECT TO authenticated
    USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']));
  CREATE POLICY "Membros ativos geram mensalidades pendentes" ON public.mensalidades FOR INSERT TO authenticated
    WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']) AND status='pendente' AND data_pagamento IS NULL);
  REVOKE ALL ON TABLE public.mensalidades FROM anon, authenticated;
  GRANT SELECT, INSERT ON TABLE public.mensalidades TO authenticated;

  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='pix_pagamentos' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pix_pagamentos', policy_row.policyname);
  END LOOP;
  ALTER TABLE public.pix_pagamentos ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Membros ativos veem pagamentos PIX" ON public.pix_pagamentos FOR SELECT TO authenticated
    USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']));
  CREATE POLICY "Membros ativos criam pagamentos PIX pendentes" ON public.pix_pagamentos FOR INSERT TO authenticated
    WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']) AND status='pending' AND pago_em IS NULL);
  REVOKE ALL ON TABLE public.pix_pagamentos FROM anon, authenticated;
  GRANT SELECT, INSERT ON TABLE public.pix_pagamentos TO authenticated;

  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='auditoria' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.auditoria', policy_row.policyname);
  END LOOP;
  ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Membros ativos veem auditoria" ON public.auditoria FOR SELECT TO authenticated
    USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']));
  REVOKE ALL ON TABLE public.auditoria FROM anon, authenticated;
  GRANT SELECT ON TABLE public.auditoria TO authenticated;
END
$migration$;

-- Relacoes sem tenant_id proprio herdam o tenant do registro pai.
DO $migration$
DECLARE policy_row record;
BEGIN
  IF to_regclass('public.variantes') IS NOT NULL THEN
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='variantes' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.variantes', policy_row.policyname);
    END LOOP;
    CREATE POLICY "Membros ativos leem variantes" ON public.variantes FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id=variantes.produto_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager'])));
    CREATE POLICY "Gestores administram variantes" ON public.variantes FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id=variantes.produto_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager'])))
      WITH CHECK (EXISTS (SELECT 1 FROM public.produtos p WHERE p.id=variantes.produto_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager'])));
  END IF;
END
$migration$;

DO $migration$
DECLARE relation_row record; policy_row record;
BEGIN
  FOR relation_row IN SELECT * FROM (VALUES
    ('produto_complementos', $predicate$EXISTS (SELECT 1 FROM public.produtos p JOIN public.complementos c ON c.id=produto_complementos.complemento_id AND c.tenant_id=p.tenant_id WHERE p.id=produto_complementos.produto_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager']))$predicate$, $predicate$EXISTS (SELECT 1 FROM public.produtos p JOIN public.complementos c ON c.id=produto_complementos.complemento_id AND c.tenant_id=p.tenant_id WHERE p.id=produto_complementos.produto_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager']))$predicate$),
    ('complemento_categorias', $predicate$EXISTS (SELECT 1 FROM public.complementos c JOIN public.categorias_complementos g ON g.id=complemento_categorias.categoria_id AND g.tenant_id=c.tenant_id WHERE c.id=complemento_categorias.complemento_id AND public.has_active_tenant_role(c.tenant_id, ARRAY['owner','manager']))$predicate$, $predicate$EXISTS (SELECT 1 FROM public.complementos c JOIN public.categorias_complementos g ON g.id=complemento_categorias.categoria_id AND g.tenant_id=c.tenant_id WHERE c.id=complemento_categorias.complemento_id AND public.has_active_tenant_role(c.tenant_id, ARRAY['owner','manager']))$predicate$),
    ('pedido_complementos', $predicate$EXISTS (SELECT 1 FROM public.pedido_itens i JOIN public.pedidos p ON p.id=i.pedido_id LEFT JOIN public.complementos c ON c.id=pedido_complementos.complemento_id WHERE i.id=pedido_complementos.pedido_item_id AND (pedido_complementos.complemento_id IS NULL OR c.tenant_id=p.tenant_id) AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager']))$predicate$, $predicate$EXISTS (SELECT 1 FROM public.pedido_itens i JOIN public.pedidos p ON p.id=i.pedido_id LEFT JOIN public.complementos c ON c.id=pedido_complementos.complemento_id WHERE i.id=pedido_complementos.pedido_item_id AND (pedido_complementos.complemento_id IS NULL OR c.tenant_id=p.tenant_id) AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager','attendant','kitchen']))$predicate$),
    ('produto_insumos', $predicate$EXISTS (SELECT 1 FROM public.produtos p JOIN public.insumos i ON i.id=produto_insumos.insumo_id AND i.tenant_id=p.tenant_id WHERE p.id=produto_insumos.produto_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager']))$predicate$, $predicate$EXISTS (SELECT 1 FROM public.produtos p JOIN public.insumos i ON i.id=produto_insumos.insumo_id AND i.tenant_id=p.tenant_id WHERE p.id=produto_insumos.produto_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager']))$predicate$),
    ('movimentacoes_estoque', $predicate$EXISTS (SELECT 1 FROM public.insumos i WHERE i.id=movimentacoes_estoque.insumo_id AND public.has_active_tenant_role(i.tenant_id, ARRAY['owner','manager']))$predicate$, $predicate$EXISTS (SELECT 1 FROM public.insumos i WHERE i.id=movimentacoes_estoque.insumo_id AND public.has_active_tenant_role(i.tenant_id, ARRAY['owner','manager']))$predicate$),
    ('pedido_status_historico', $predicate$EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_status_historico.pedido_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager']))$predicate$, $predicate$EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_status_historico.pedido_id AND public.has_active_tenant_role(p.tenant_id, ARRAY['owner','manager','attendant','kitchen','delivery','motoboy']))$predicate$),
    ('despesa_pagamentos', $predicate$EXISTS (SELECT 1 FROM public.despesas d WHERE d.id=despesa_pagamentos.despesa_id AND public.has_active_tenant_role(d.tenant_id, ARRAY['owner','manager']))$predicate$, $predicate$EXISTS (SELECT 1 FROM public.despesas d WHERE d.id=despesa_pagamentos.despesa_id AND public.has_active_tenant_role(d.tenant_id, ARRAY['owner','manager']))$predicate$)
  ) AS relations(table_name, read_predicate, write_predicate) LOOP
    IF to_regclass(format('public.%I', relation_row.table_name)) IS NULL THEN CONTINUE; END IF;
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=relation_row.table_name LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, relation_row.table_name);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_row.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', 'Membros ativos leem dados relacionados', relation_row.table_name, relation_row.read_predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', 'Papeis autorizados administram dados relacionados', relation_row.table_name, relation_row.write_predicate, relation_row.write_predicate);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', relation_row.table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', relation_row.table_name);
  END LOOP;
END
$migration$;

DO $migration$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname,tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('pedido_itens','enderecos_entrega') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',r.policyname,r.tablename);
  END LOOP;
END
$migration$;
CREATE POLICY "Membros ativos veem itens do pedido" ON public.pedido_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true
  ));
CREATE POLICY "OperaÃ§Ã£o cria itens do pedido" ON public.pedido_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true
      AND u.role IN ('owner','manager','attendant')
  ));
CREATE POLICY "AdministraÃ§Ã£o altera itens do pedido" ON public.pedido_itens FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true AND u.role IN ('owner','manager','attendant')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true AND u.role IN ('owner','manager','attendant')
  ));
CREATE POLICY "AdministraÃ§Ã£o exclui itens do pedido" ON public.pedido_itens FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true AND u.role IN ('owner','manager')
  ));

-- A policy pÃºblica antiga nÃ£o filtrava `ativo`, e continuaria liberando bairros
-- inativos por OR mesmo com a policy mais restritiva da migration 044.
DROP POLICY IF EXISTS "EndereÃ§os visÃ­veis ao tenant" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Enderecos visiveis ao tenant" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Cardapio publico ve areas de entrega" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Bairros ativos pÃºblicos" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Membros administrativos gerenciam bairros" ON public.enderecos_entrega;

CREATE POLICY "Bairros ativos pÃºblicos" ON public.enderecos_entrega
  FOR SELECT TO anon
  USING (ativo=true AND EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id=enderecos_entrega.tenant_id AND t.status='active'
  ));

CREATE POLICY "Membros administrativos gerenciam bairros" ON public.enderecos_entrega
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios_loja u
    WHERE u.user_id=auth.uid() AND u.tenant_id=enderecos_entrega.tenant_id
      AND u.ativo=true AND u.role IN ('owner','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios_loja u
    WHERE u.user_id=auth.uid() AND u.tenant_id=enderecos_entrega.tenant_id
      AND u.ativo=true AND u.role IN ('owner','manager')
  ));

-- Mantem as restricoes operacionais granulares consolidadas na migration 046,
-- removendo apenas eventuais policies extras perigosas por nome conhecido.
DROP POLICY IF EXISTS "Admin full access pagamentos" ON public.pagamentos;
DROP POLICY IF EXISTS "Admin full access pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Admin full access pedido_itens" ON public.pedido_itens;
DROP POLICY IF EXISTS "Admin full access enderecos_entrega" ON public.enderecos_entrega;

-- Reaplica least privilege nas tabelas que possuem fluxos por papel.
DROP POLICY IF EXISTS "Categorias de produtos do tenant" ON public.categorias_produtos;
DROP POLICY IF EXISTS "Membros ativos leem categorias de produtos" ON public.categorias_produtos;
DROP POLICY IF EXISTS "Gestores administram categorias de produtos" ON public.categorias_produtos;
CREATE POLICY "Membros ativos leem categorias de produtos" ON public.categorias_produtos FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(tenant_id));
CREATE POLICY "Gestores administram categorias de produtos" ON public.categorias_produtos FOR ALL TO authenticated
  USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']))
  WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']));

DO $migration$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='pedidos' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pedidos', policy_row.policyname);
  END LOOP;
  CREATE POLICY "Operacao le pedidos" ON public.pedidos FOR SELECT TO authenticated
    USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager','attendant','kitchen']));
  CREATE POLICY "Entrega le pedidos despachaveis" ON public.pedidos FOR SELECT TO authenticated
    USING (status IN ('pronto','saiu','entregue') AND public.has_active_tenant_role(tenant_id, ARRAY['delivery','motoboy']));
  CREATE POLICY "Operacao cria pedidos" ON public.pedidos FOR INSERT TO authenticated
    WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager','attendant']));
  CREATE POLICY "Operacao atualiza pedidos" ON public.pedidos FOR UPDATE TO authenticated
    USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager','attendant','kitchen','delivery','motoboy']))
    WITH CHECK (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager','attendant','kitchen','delivery','motoboy']));
  CREATE POLICY "Gestores excluem pedidos" ON public.pedidos FOR DELETE TO authenticated
    USING (public.has_active_tenant_role(tenant_id, ARRAY['owner','manager']));
END
$migration$;

-- UPDATE de pedidos fica limitado a colunas operacionais e transicoes por papel.
REVOKE SELECT ON TABLE public.pedidos FROM authenticated;
GRANT SELECT (id,tenant_id,status,valor_total,taxa_entrega,data_criacao,data_atualizacao,tempo_estimado_min,created_at,valor_subtotal,tipo_entrega,motoboy_id,motoboy_comissao) ON public.pedidos TO authenticated;REVOKE UPDATE ON TABLE public.pedidos FROM authenticated;
GRANT UPDATE (status, data_atualizacao, motoboy_id) ON TABLE public.pedidos TO authenticated;
CREATE OR REPLACE FUNCTION public.validar_atualizacao_operacional_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text; v_old text := OLD.status::text; v_new text := NEW.status::text;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT role INTO v_role FROM public.usuarios_loja
   WHERE user_id=auth.uid() AND tenant_id=OLD.tenant_id AND ativo=true
   ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END LIMIT 1;
  IF v_role IS NULL OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN RAISE EXCEPTION 'pedido nao autorizado'; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','data_atualizacao','motoboy_id','motoboy_comissao']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','data_atualizacao','motoboy_id','motoboy_comissao']) THEN RAISE EXCEPTION 'campos de pedido nao autorizados'; END IF;
  IF v_role IN ('owner','manager') THEN RETURN NEW; END IF;
  IF NEW.motoboy_id IS DISTINCT FROM OLD.motoboy_id THEN RAISE EXCEPTION 'papel nao pode atribuir motoboy'; END IF;
  IF v_role='attendant' AND NOT (v_new=v_old OR (v_old='novo' AND v_new IN ('preparando','cancelado'))) THEN RAISE EXCEPTION 'transicao nao permitida'; END IF;
  IF v_role='kitchen' AND NOT (v_new=v_old OR (v_old IN ('novo','preparando') AND v_new IN ('preparando','pronto'))) THEN RAISE EXCEPTION 'transicao nao permitida'; END IF;
  IF v_role IN ('delivery','motoboy') AND NOT (v_new=v_old OR (v_old='pronto' AND v_new='saiu') OR (v_old='saiu' AND v_new='entregue')) THEN RAISE EXCEPTION 'transicao nao permitida'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_atualizacao_operacional_pedido ON public.pedidos;
CREATE TRIGGER trg_validar_atualizacao_operacional_pedido BEFORE UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.validar_atualizacao_operacional_pedido();
REVOKE ALL ON FUNCTION public.validar_atualizacao_operacional_pedido() FROM PUBLIC, anon, authenticated;
-- Sorteio confere a associacao ativa da campanha em vez de comparar tenant com uid.
CREATE OR REPLACE FUNCTION public.sortear_campanha(p_campanha_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid; v_cupom uuid; v_seed uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.campanhas_sorteio WHERE id=p_campanha_id FOR UPDATE;
  IF v_tenant IS NULL OR NOT public.has_active_tenant_role(v_tenant, ARRAY['owner','manager']) THEN RAISE EXCEPTION 'campanha nao autorizada'; END IF;
  IF EXISTS (SELECT 1 FROM public.campanhas_sorteio WHERE id=p_campanha_id AND sorteado_em IS NOT NULL) THEN RAISE EXCEPTION 'campanha ja sorteada'; END IF;
  v_seed := gen_random_uuid();
  SELECT id INTO v_cupom FROM public.cupons_sorteio WHERE campanha_id=p_campanha_id ORDER BY md5(id::text || v_seed::text) LIMIT 1;
  IF v_cupom IS NULL THEN RAISE EXCEPTION 'campanha sem cupons'; END IF;
  UPDATE public.campanhas_sorteio SET vencedor_cupom_id=v_cupom,sorteado_em=now(),seed_auditoria=v_seed,ativo=false WHERE id=p_campanha_id;
  RETURN v_cupom;
END $$;
-- Reconstroi somente as leituras anonimas necessarias ao catalogo ativo.
CREATE POLICY "Catalogo publico ve categorias ativas" ON public.categorias
  FOR SELECT TO anon USING (ativo=true AND EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id=categorias.tenant_id AND t.status='active'));
CREATE POLICY "Catalogo publico ve produtos ativos" ON public.produtos
  FOR SELECT TO anon USING (ativo=true AND EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id=produtos.tenant_id AND t.status='active'));
CREATE POLICY "Catalogo publico ve variantes ativas" ON public.variantes
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public.produtos p JOIN public.tenants t ON t.id=p.tenant_id
    WHERE p.id=variantes.produto_id AND p.ativo=true AND t.status='active'));
CREATE POLICY "Catalogo publico ve complementos ativos" ON public.complementos
  FOR SELECT TO anon USING (ativo=true AND EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id=complementos.tenant_id AND t.status='active'));
CREATE POLICY "Catalogo publico ve vinculos de complementos" ON public.produto_complementos
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public.produtos p JOIN public.tenants t ON t.id=p.tenant_id
    WHERE p.id=produto_complementos.produto_id AND p.ativo=true AND t.status='active'));

DROP POLICY IF EXISTS "Categorias de produtos publicas" ON public.categorias_produtos;
CREATE POLICY "Categorias de produtos publicas" ON public.categorias_produtos
  FOR SELECT TO anon USING (ativo=true AND EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id=categorias_produtos.tenant_id AND t.status='active'));

CREATE POLICY "Catalogo publico ve listas de complementos" ON public.categorias_complementos
  FOR SELECT TO anon USING (ativo=true AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.status='active'));
CREATE POLICY "Catalogo publico ve avaliacoes aprovadas" ON public.avaliacoes
  FOR SELECT TO anon USING (aprovado=true AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.status='active'));
REVOKE SELECT ON TABLE public.categorias, public.produtos, public.variantes,
  public.complementos, public.produto_complementos, public.categorias_produtos,
  public.categorias_complementos, public.avaliacoes FROM anon;
GRANT SELECT (id,tenant_id,nome,ordem,ativo) ON public.categorias TO anon;
GRANT SELECT (id,tenant_id,categoria_id,categoria_produto_id,nome,descricao,imagem_url,preco,ativo,tempo_preparo_min,preco_riscado,etiquetas)
  ON public.produtos TO anon;
GRANT SELECT (id,produto_id,nome,preco_adicional) ON public.variantes TO anon;
GRANT SELECT (id,tenant_id,categoria_id,nome,descricao,preco,ativo,ordem,imagem_url,imagem_path,etiqueta1,etiqueta2,etiqueta3,qtd_max) ON public.complementos TO anon;
GRANT SELECT (produto_id,complemento_id) ON public.produto_complementos TO anon;
GRANT SELECT (id,tenant_id,nome,ordem,ativo) ON public.categorias_produtos TO anon;
GRANT SELECT (id,tenant_id,nome,ordem,ativo,qtd_minima,qtd_maxima,max_um_de_cada,imagem_url) ON public.categorias_complementos TO anon;
GRANT SELECT (tenant_id,nota,comentario,resposta_admin,created_at) ON public.avaliacoes TO anon;

-- Configuracao global: a chave administrativa nunca e publica. Escritas do
-- painel admin continuam via service_role; paginas legais permanecem publicas.
DO $migration$
DECLARE policy_row record;
BEGIN
  IF to_regclass('public.saas_config') IS NOT NULL THEN
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='saas_config' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.saas_config', policy_row.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.saas_config ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Configuracoes operacionais autenticadas" ON public.saas_config FOR SELECT TO authenticated USING (chave IN (''pix'',''trial'',''geral''))';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.saas_config FROM anon, authenticated';
    EXECUTE 'REVOKE SELECT ON TABLE public.saas_config FROM anon';
    EXECUTE 'GRANT SELECT ON TABLE public.saas_config TO authenticated';
  END IF;
  IF to_regclass('public.saas_paginas') IS NOT NULL THEN
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='saas_paginas' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.saas_paginas', policy_row.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE public.saas_paginas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Paginas legais sao publicas" ON public.saas_paginas FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.saas_paginas FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.saas_paginas TO anon, authenticated';
  END IF;
END
$migration$;

DO $migration$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND (coalesce(qual,'')||' '||coalesce(with_check,'')) ~ '(produtos|cardapio-assets|complementos|logos)'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects',r.policyname); END LOOP;
END
$migration$;
-- Storage: membros de equipe podem gerenciar o diretorio do tenant. Leitura
-- continua publica somente nos quatro buckets publicos do cardapio.
DROP POLICY IF EXISTS "Lojista upa suas prÃ³prias imagens" ON storage.objects;
DROP POLICY IF EXISTS "Lojista deleta suas prÃ³prias imagens" ON storage.objects;
DROP POLICY IF EXISTS "Produtos sÃ£o pÃºblicos" ON storage.objects;
DROP POLICY IF EXISTS "Lojista gerencia assets do cardapio" ON storage.objects;
DROP POLICY IF EXISTS "Assets do cardapio sao publicos" ON storage.objects;
DROP POLICY IF EXISTS "Lojista gerencia imagens de complementos" ON storage.objects;
DROP POLICY IF EXISTS "Imagens de complementos sao publicas" ON storage.objects;
DROP POLICY IF EXISTS "Membros gerenciam imagens do tenant" ON storage.objects;
DROP POLICY IF EXISTS "Imagens do cardapio sao publicas" ON storage.objects;

CREATE POLICY "Membros gerenciam imagens do tenant" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('produtos','cardapio-assets','complementos','logos')
    AND public.has_active_tenant_role(
      CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (storage.foldername(name))[1]::uuid END, ARRAY['owner','manager']
    )
  )
  WITH CHECK (
    bucket_id IN ('produtos','cardapio-assets','complementos','logos')
    AND public.has_active_tenant_role(
      CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (storage.foldername(name))[1]::uuid END, ARRAY['owner','manager']
    )
  );
CREATE POLICY "Imagens do cardapio sao publicas" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('produtos','cardapio-assets','complementos','logos'));

-- Recria RPCs ausentes em ambientes legados antes de fechar suas ACLs.
CREATE OR REPLACE FUNCTION public.registrar_auditoria(p_tenant_id uuid,p_user_id uuid,p_acao text,p_tabela text,p_registro_id uuid,p_dados_anteriores jsonb,p_dados_novos jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.auditoria(tenant_id,user_id,acao,tabela,registro_id,dados_anteriores,dados_novos) VALUES(p_tenant_id,p_user_id,p_acao,p_tabela,p_registro_id,p_dados_anteriores,p_dados_novos); END; $$;
CREATE OR REPLACE FUNCTION public.verificar_trial_tenant(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_limite numeric;v_em_ciclo boolean;v_faturamento numeric;v_dia_vencimento integer;v_dia integer;v_inicio_mes date;v_inicio_anterior date;
BEGIN SELECT (valor->>'limite_faturamento_mensal')::numeric,(valor->>'dia_vencimento')::integer INTO v_limite,v_dia_vencimento FROM public.saas_config WHERE chave='trial';v_dia_vencimento:=coalesce(v_dia_vencimento,10);v_limite:=coalesce(v_limite,2000);SELECT em_ciclo_cobranca INTO v_em_ciclo FROM public.tenants WHERE id=p_tenant_id;v_dia:=extract(day from now())::integer;v_inicio_mes:=date_trunc('month',now())::date;v_inicio_anterior:=(v_inicio_mes-interval '1 month')::date;
IF v_em_ciclo THEN IF NOT EXISTS(SELECT 1 FROM public.mensalidades WHERE tenant_id=p_tenant_id AND mes=extract(month from now())::integer AND status='pago') AND v_dia>v_dia_vencimento THEN UPDATE public.tenants SET bloqueado=true,motivo_bloqueio='Mensalidade vencida. Pague para liberar.',data_bloqueio=now() WHERE id=p_tenant_id;ELSE UPDATE public.tenants SET bloqueado=false,motivo_bloqueio=null WHERE id=p_tenant_id AND bloqueado=true;END IF;
ELSE SELECT coalesce(sum(valor_total),0) INTO v_faturamento FROM public.pedidos WHERE tenant_id=p_tenant_id AND status NOT IN('cancelado','recusado') AND created_at>=v_inicio_anterior AND created_at<v_inicio_mes;IF v_faturamento>=v_limite AND v_dia>v_dia_vencimento THEN UPDATE public.tenants SET em_ciclo_cobranca=true,bloqueado=true,motivo_bloqueio='Faturamento anterior exige mensalidade.',data_bloqueio=now() WHERE id=p_tenant_id;ELSE UPDATE public.tenants SET bloqueado=false,motivo_bloqueio=null WHERE id=p_tenant_id AND bloqueado=true;END IF;END IF;END;$$;
-- Allowlist explicita de SECURITY DEFINER. Funcoes de trigger nao recebem
-- EXECUTE de papeis da API; RPCs recebem apenas os chamadores documentados.
DO $migration$
DECLARE signature text; function_oid regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.handle_new_user()', 'public.criar_historico_status()',
    'public.verificar_trial_tenant(uuid)',
    'public.registrar_auditoria(uuid,uuid,text,text,uuid,jsonb,jsonb)',
    'public.incrementar_usos_cupom(uuid,text)', 'public.gerar_cupons_sorteio_pedido()',
    'public.consume_api_rate_limit(text,integer,integer)',
    'public.aceitar_convite_loja(text)',
    'public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb)',
    'public.is_active_tenant_member(uuid)', 'public.has_active_tenant_role(uuid,text[])',
    'public.validar_atualizacao_operacional_pedido()', 'public.sortear_campanha(uuid)'
  ] LOOP
    function_oid := to_regprocedure(signature);
    IF function_oid IS NOT NULL THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_oid); END IF;
  END LOOP;
END
$migration$;
GRANT EXECUTE ON FUNCTION public.is_active_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_tenant_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_convite_loja(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sortear_campanha(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.criar_pedido_atomico(uuid, text, text, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_auditoria(uuid, uuid, text, text, uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.verificar_trial_tenant(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.incrementar_usos_cupom(uuid, text) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.pagamentos, public.variantes, public.categorias_produtos FROM anon;

REVOKE ALL ON FUNCTION public.fn_historico_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registrar_auditoria(uuid,uuid,text,text,uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_verificar_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_auditoria(uuid,uuid,text,text,uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_verificar_trial(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
