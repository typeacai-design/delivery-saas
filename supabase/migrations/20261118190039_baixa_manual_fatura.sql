ALTER TABLE public.faturas_assinatura
  ADD COLUMN baixa_manual_em timestamptz,
  ADD COLUMN baixa_manual_por text,
  ADD CONSTRAINT faturas_assinatura_baixa_manual_completa
    CHECK ((baixa_manual_em IS NULL) = (baixa_manual_por IS NULL));

CREATE OR REPLACE FUNCTION public.conciliar_fatura_assinatura(
  p_fatura_id uuid, p_pagamento_id text, p_valor_centavos bigint, p_atualizado_em timestamptz, p_aprovado_em timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.faturas_assinatura
  WHERE id = p_fatura_id AND valor_centavos = p_valor_centavos AND checkout_url IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.pagamentos_fatura_assinatura AS anterior (mp_pagamento_id, fatura_id, atualizado_em, aprovado_em)
  VALUES (p_pagamento_id, p_fatura_id, p_atualizado_em, p_aprovado_em)
  ON CONFLICT (mp_pagamento_id) DO UPDATE SET atualizado_em = excluded.atualizado_em, aprovado_em = excluded.aprovado_em
  WHERE anterior.fatura_id = excluded.fatura_id AND anterior.atualizado_em < excluded.atualizado_em;

  UPDATE public.faturas_assinatura AS f SET
    (mp_pagamento_id, pago_em) = (
      SELECT pagamento.mp_pagamento_id, coalesce(f.baixa_manual_em, pagamento.aprovado_em)
      FROM (VALUES (1)) AS linha(n)
      LEFT JOIN LATERAL (
        SELECT p.mp_pagamento_id, p.aprovado_em
        FROM public.pagamentos_fatura_assinatura p
        WHERE p.fatura_id = f.id AND p.aprovado_em IS NOT NULL
        ORDER BY p.aprovado_em, p.mp_pagamento_id LIMIT 1
      ) pagamento ON true
    )
  WHERE f.id = p_fatura_id;
END;
$$;
