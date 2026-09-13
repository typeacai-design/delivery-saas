-- Migration 059: Libera tipo_entrega='mesa' e adiciona mesa_id em pedidos
-- Suporta a feature de gestão de mesas do salão (Configurações → Mesas)

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_tipo_entrega_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_tipo_entrega_check
  CHECK (tipo_entrega IN ('delivery', 'retirada', 'mesa'));

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS mesa_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_mesa ON public.pedidos(mesa_id) WHERE mesa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_tipo_mesa ON public.pedidos(tipo_entrega, data_criacao) WHERE tipo_entrega = 'mesa';
