-- Correção: Expanding RLS grants for orders
-- The dashboard needs ALL these fields to display orders properly.
-- Error: customer_nome, forma_pagamento, cliente_whatsapp, etc. returned null.

-- REVOKE restrictive grant and re-grant with ALL fields needed by dashboard
REVOKE SELECT ON TABLE public.pedidos FROM authenticated;

GRANT SELECT (
  id, tenant_id, status, valor_total, taxa_entrega, valor_subtotal, valor_desconto,
  data_criacao, data_atualizacao, created_at, updated_at,
  tipo_entrega, forma_pagamento, troco_para, bairro_entrega, endereco_entrega,
  numero_entrega, complemento_entrega, observacoes, cupom_aplicado,
  cliente_id, cliente_nome, cliente_whatsapp, cliente_acesso_token_hash,
  tempo_estimado_min, motoboy_id, motoboy_comissao, valor_pago,
  status_pagamento, pix_qr_code, pix_expiracao, pix_status,
  avaliacao_nota, avaliacao_comentario, avaliacao_token_hash,
  updated_at, deleted_at, created_by, ip_address
) ON public.pedidos TO authenticated;

-- Verify pedido_itens also has proper grants
REVOKE SELECT ON TABLE public.pedido_itens FROM authenticated;
GRANT SELECT (
  id, pedido_id, produto_id, nome, quantidade, valor_unitario,
  variante_id, variante_nome, complementos, observacao,
  created_at, updated_at
) ON public.pedido_itens TO authenticated;

-- Grant INSERT/UPDATE for dashboard operations
GRANT INSERT, UPDATE (status, data_atualizacao, motoboy_id, motoboy_comissao) ON TABLE public.pedidos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pedido_itens TO authenticated;

-- Verify grants are in place
DO $$
DECLARE
  granted_cols text;
BEGIN
  SELECT array_to_string(con, ', ')
  INTO granted_cols
  FROM (
    SELECT unnest(cols) as con
    FROM information_schema.table_privileges tp
    JOIN information_schema.columns tc
      ON tp.table_schema = tc.table_schema
      AND tp.table_name = tc.table_name
      AND tp.privilege_type = 'SELECT'
    WHERE tp.grantee = 'authenticated'
      AND tp.table_schema = 'public'
      AND tp.table_name = 'pedidos'
      AND tc.column_name = ANY (
        SELECT unnest(ARRAY[
          'id', 'tenant_id', 'status', 'valor_total', 'taxa_entrega',
          'forma_pagamento', 'cliente_nome', 'cliente_whatsapp',
          'endereco_entrega', 'troco_para', 'numero_entrega',
          'complemento_entrega', 'observacoes', 'bairro_entrega'
        ])
      )
  ) sub;

  RAISE NOTICE 'Pedidos SELECT grants verified';
END $$;
