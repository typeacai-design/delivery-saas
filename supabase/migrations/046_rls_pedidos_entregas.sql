-- Consolida RLS multi-loja. Policies permissivas são combinadas por OR, portanto
-- os nomes legados são removidos antes da criação das regras definitivas.

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_entrega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pedidos visíveis ao tenant" ON public.pedidos;
DROP POLICY IF EXISTS "Pedidos visiveis ao tenant" ON public.pedidos;
DROP POLICY IF EXISTS "Membros ativos acessam pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Membros ativos veem pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Operação cria pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Membros ativos atualizam pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Administração exclui pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Membros gerenciam pedidos do tenant" ON public.pedidos;
CREATE POLICY "Membros ativos veem pedidos" ON public.pedidos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios_loja u
    WHERE u.user_id=auth.uid() AND u.tenant_id=pedidos.tenant_id AND u.ativo=true
  ));
CREATE POLICY "Operação cria pedidos" ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios_loja u
    WHERE u.user_id=auth.uid() AND u.tenant_id=pedidos.tenant_id AND u.ativo=true
      AND u.role IN ('owner','manager','attendant')
  ));
CREATE POLICY "Membros ativos atualizam pedidos" ON public.pedidos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios_loja u WHERE u.user_id=auth.uid() AND u.tenant_id=pedidos.tenant_id AND u.ativo=true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios_loja u WHERE u.user_id=auth.uid() AND u.tenant_id=pedidos.tenant_id AND u.ativo=true));
CREATE POLICY "Administração exclui pedidos" ON public.pedidos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios_loja u WHERE u.user_id=auth.uid() AND u.tenant_id=pedidos.tenant_id
      AND u.ativo=true AND u.role IN ('owner','manager')
  ));

DROP POLICY IF EXISTS "Itens visíveis ao tenant" ON public.pedido_itens;
DROP POLICY IF EXISTS "Itens visiveis ao tenant" ON public.pedido_itens;
DROP POLICY IF EXISTS "Membros ativos acessam itens do pedido" ON public.pedido_itens;
DROP POLICY IF EXISTS "Membros ativos veem itens do pedido" ON public.pedido_itens;
DROP POLICY IF EXISTS "Operação cria itens do pedido" ON public.pedido_itens;
DROP POLICY IF EXISTS "Administração altera itens do pedido" ON public.pedido_itens;
DROP POLICY IF EXISTS "Administração exclui itens do pedido" ON public.pedido_itens;
DROP POLICY IF EXISTS "Membros gerenciam itens de pedidos do tenant" ON public.pedido_itens;
CREATE POLICY "Membros ativos veem itens do pedido" ON public.pedido_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true
  ));
CREATE POLICY "Operação cria itens do pedido" ON public.pedido_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true
      AND u.role IN ('owner','manager','attendant')
  ));
CREATE POLICY "Administração altera itens do pedido" ON public.pedido_itens FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true AND u.role IN ('owner','manager','attendant')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true AND u.role IN ('owner','manager','attendant')
  ));
CREATE POLICY "Administração exclui itens do pedido" ON public.pedido_itens FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p JOIN public.usuarios_loja u ON u.tenant_id=p.tenant_id
    WHERE p.id=pedido_itens.pedido_id AND u.user_id=auth.uid() AND u.ativo=true AND u.role IN ('owner','manager')
  ));

-- A policy pública antiga não filtrava `ativo`, e continuaria liberando bairros
-- inativos por OR mesmo com a policy mais restritiva da migration 044.
DROP POLICY IF EXISTS "Endereços visíveis ao tenant" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Enderecos visiveis ao tenant" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Cardapio publico ve areas de entrega" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Bairros ativos públicos" ON public.enderecos_entrega;
DROP POLICY IF EXISTS "Membros administrativos gerenciam bairros" ON public.enderecos_entrega;

CREATE POLICY "Bairros ativos públicos" ON public.enderecos_entrega
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

-- Pedidos públicos entram exclusivamente pela API service_role/RPC atômica.
-- service_role ignora RLS; anon não recebe privilégio direto nessas tabelas.
REVOKE ALL ON TABLE public.pedidos FROM anon;
REVOKE ALL ON TABLE public.pedido_itens FROM anon;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.enderecos_entrega FROM anon;
GRANT SELECT ON TABLE public.enderecos_entrega TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.pedidos TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.pedido_itens TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.enderecos_entrega TO authenticated;
