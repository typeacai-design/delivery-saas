-- Business calendar only: preserve existing timestamps, rows, privileges and RLS.
-- Explicit per-function TimeZone prevents CURRENT_DATE from inheriting a client setting.
ALTER FUNCTION public.criar_pedido_atomico(uuid,text,text,jsonb,jsonb,jsonb,boolean,text) SET TimeZone = 'America/Sao_Paulo';
ALTER FUNCTION public.fechar_sessao_mesa_financeiro(uuid,uuid,text,numeric) SET TimeZone = 'America/Sao_Paulo';
ALTER FUNCTION public.verificar_loja_aberta(uuid) SET TimeZone = 'America/Sao_Paulo';
ALTER FUNCTION public.verificar_trial_tenant(uuid) SET TimeZone = 'America/Sao_Paulo';
-- mobile_inicio already explicitly computes São Paulo midnight.
ALTER TABLE public.comissoes_mensais ALTER COLUMN data_geracao SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
ALTER TABLE public.movimentacoes_financeiras ALTER COLUMN data SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
ALTER TABLE public.pagamentos ALTER COLUMN data_pagamento SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
ALTER TABLE public.tenants ALTER COLUMN data_inicio_trial SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
