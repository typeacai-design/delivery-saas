BEGIN;
GRANT SELECT (tipo_pedido) ON TABLE public.pedidos TO authenticated;
GRANT SELECT (tempo_preparo_extra_minutos) ON TABLE public.tenants TO authenticated;
COMMIT;
