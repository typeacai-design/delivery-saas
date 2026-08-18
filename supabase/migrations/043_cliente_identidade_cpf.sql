-- Identidade local anônima por loja. CPF fica apenas no cadastro do cliente,
-- evitando duplicação de dado pessoal em cada pedido.
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS acesso_token_hash text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_acesso_token_hash text;

-- Instalações antigas usam data_criacao; o código público atual usa created_at.
-- Preserve o histórico existente ao normalizar o nome sem remover a coluna legada.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS created_at timestamptz;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'data_criacao'
  ) THEN
    EXECUTE 'UPDATE public.pedidos SET created_at = COALESCE(data_criacao, now()) WHERE created_at IS NULL';
  ELSE
    UPDATE public.pedidos SET created_at = now() WHERE created_at IS NULL;
  END IF;
END $$;
ALTER TABLE public.pedidos ALTER COLUMN created_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_token_tenant
  ON public.clientes (tenant_id, acesso_token_hash)
  WHERE acesso_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_token
  ON public.pedidos (tenant_id, cliente_acesso_token_hash, created_at DESC)
  WHERE cliente_acesso_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer DEFAULT 60)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO api_rate_limits(key_hash, window_started_at, request_count)
  VALUES (p_key_hash, now(), 1)
  ON CONFLICT (key_hash) DO UPDATE SET
    window_started_at = CASE WHEN api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN now() ELSE api_rate_limits.window_started_at END,
    request_count = CASE WHEN api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN 1 ELSE api_rate_limits.request_count + 1 END
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_limit;
END $$;
REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;
