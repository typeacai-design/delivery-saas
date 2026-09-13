-- Consolida 3 overloads de criar_pedido_atomico em apenas 1.
-- Bug: PGRST203 "Could not choose the best candidate function" quando
-- o cliente tentava finalizar pedido. Causava erro generico
-- "Nao foi possivel concluir o pedido" (HTTP 409).
--
-- Mantem apenas a versao mais recente (com p_convite_codigo) que ja
-- inclui toda a logica de estoque corrigido (migration 048) e suporte
-- a cupom.

DROP FUNCTION IF EXISTS public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb,boolean);
