-- Migration: 049_seguranca_correcoes
-- Data: 2026-08-19
-- Descrição: Correções de segurança no banco

-- 1. CRÍTICO: Revogar execução de criar_pedido_atomico do anon
-- A função ainda pode ser chamada via API REST authenticated, mas não mais via anon
REVOKE EXECUTE ON FUNCTION public.criar_pedido_atomico(uuid, text, text, jsonb, jsonb, jsonb, boolean) FROM anon;

-- 2. Fix search_path mutável em todas as funções (prevenir SQL injection)
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.fn_verificar_trial(uuid) SET search_path = public;
ALTER FUNCTION public.fn_historico_status() SET search_path = public;
ALTER FUNCTION public.fn_registrar_auditoria(uuid, uuid, text, text, uuid, jsonb, jsonb) SET search_path = public;
ALTER FUNCTION public.atualizar_metricas_cliente() SET search_path = public;
ALTER FUNCTION public.aplicar_comissao_motoboy() SET search_path = public;

-- 3. Criar RLS policies para pagamentos
CREATE POLICY "tenant_pagamentos_select" ON public.pagamentos FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM usuarios_loja WHERE user_id = auth.uid() AND ativo = true
));
CREATE POLICY "tenant_pagamentos_insert" ON public.pagamentos FOR INSERT WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM usuarios_loja WHERE user_id = auth.uid() AND ativo = true
));
CREATE POLICY "tenant_pagamentos_update" ON public.pagamentos FOR UPDATE USING (tenant_id IN (
  SELECT tenant_id FROM usuarios_loja WHERE user_id = auth.uid() AND ativo = true
));
CREATE POLICY "tenant_pagamentos_delete" ON public.pagamentos FOR DELETE USING (tenant_id IN (
  SELECT tenant_id FROM usuarios_loja WHERE user_id = auth.uid() AND ativo = true
));

-- 4. Criar RLS policies para api_rate_limits (público para rate limiting)
CREATE POLICY "public_api_rate_limits_select" ON public.api_rate_limits FOR SELECT USING (true);
CREATE POLICY "public_api_rate_limits_update" ON public.api_rate_limits FOR UPDATE USING (true);
CREATE POLICY "public_api_rate_limits_insert" ON public.api_rate_limits FOR INSERT WITH CHECK (true);

-- 5. Criar RLS policies para convites_loja
CREATE POLICY "public_convites_insert" ON public.convites_loja FOR INSERT WITH CHECK (true);
CREATE POLICY "tenant_convites_select" ON public.convites_loja FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM usuarios_loja WHERE user_id = auth.uid() AND ativo = true
));
