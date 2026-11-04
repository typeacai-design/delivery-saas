-- Uma unica forma de pagamento por pedido em todos os canais (web, mobile e app).
-- Arrays vazios sao permitidos para pedidos de mesa ainda nao quitados.
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_uma_forma_pagamento
  CHECK (COALESCE(cardinality(forma_pagamento),0) <= 1);
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_um_valor_pago
  CHECK (COALESCE(cardinality(valor_pago),0) <= 1);
