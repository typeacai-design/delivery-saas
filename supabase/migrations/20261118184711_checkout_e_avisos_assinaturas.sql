CREATE TABLE public.conexao_mercado_pago (
  id integer PRIMARY KEY CHECK (id = 1),
  conta_id text NOT NULL,
  credenciais_cifradas text NOT NULL,
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  webhook_validado_em timestamptz
);

ALTER TABLE public.conexao_mercado_pago ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conexao_mercado_pago FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conexao_mercado_pago TO service_role;

ALTER TABLE public.faturas_assinatura
  ADD COLUMN email_destino text,
  ADD COLUMN email_reservado_em timestamptz,
  ADD COLUMN email_enviado_em timestamptz;

CREATE INDEX faturas_assinatura_email_pendente
  ON public.faturas_assinatura (vencimento, id)
  WHERE checkout_url IS NOT NULL AND pago_em IS NULL AND email_enviado_em IS NULL;
