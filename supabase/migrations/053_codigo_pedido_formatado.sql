-- Migration 053: Código do pedido formatado (XXXXX/YY)
-- Formato: 00001/26, 00002/26, etc. Os 5 primeiros dígitos são a sequência,
-- os 2 últimos são os dois últimos dígitos do ano.

-- 1. Adiciona coluna codigo se não existir
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS codigo text;

-- 2. Cria função para gerar código sequencial por tenant/ano
CREATE OR REPLACE FUNCTION public.gerar_codigo_pedido(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_ano text;
  v_seq int;
  v_codigo text;
BEGIN
  v_ano := to_char(now(), 'YY');

  SELECT COALESCE(MAX(
    NULLIF(SUBSTRING(codigo FROM 1 FOR 5), '')::int
  ), 0) + 1
  INTO v_seq
  FROM public.pedidos
  WHERE tenant_id = p_tenant_id
    AND codigo LIKE CONCAT('_____/', v_ano);

  v_codigo := LPAD(v_seq::text, 5, '0') || '/' || v_ano;

  RETURN v_codigo;
END;
$$;

-- 3. Cria trigger para gerar código automaticamente na inserção
CREATE OR REPLACE FUNCTION public.gerar_codigo_pedido_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.gerar_codigo_pedido(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_codigo_pedido ON public.pedidos;
CREATE TRIGGER trg_gerar_codigo_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_codigo_pedido_trigger();

-- 4. Adiciona índice para busca por código
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON public.pedidos(tenant_id, codigo);
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_unique ON public.pedidos(tenant_id, codigo)
  WHERE codigo IS NOT NULL;

-- 5. Atualiza códigos para pedidos existentes que não têm
UPDATE public.pedidos
SET codigo = public.gerar_codigo_pedido(tenant_id)
WHERE codigo IS NULL OR codigo = '';

-- 6. Garante que a coluna está visível para o dashboard
REVOKE SELECT ON TABLE public.pedidos FROM authenticated;
GRANT SELECT (
  id, tenant_id, cliente_id, status, valor_total, taxa_entrega, valor_subtotal, valor_desconto,
  data_criacao, data_atualizacao, created_at,
  tipo_entrega, forma_pagamento, troco, troco_para, valor_pago,
  bairro_entrega, taxa_bairro, endereco_entrega, numero_entrega, complemento_entrega,
  observacoes, cupom_aplicado, agendamento, agendamento_para,
  cliente_whatsapp, cliente_nome, cliente_acesso_token_hash,
  tempo_estimado_min, motoboy_id, motoboy_comissao,
  idempotency_key_hash,
  avaliacao_token_hash, avaliacao_token_expires_at, avaliacao_token_used_at,
  codigo
) ON public.pedidos TO authenticated;
