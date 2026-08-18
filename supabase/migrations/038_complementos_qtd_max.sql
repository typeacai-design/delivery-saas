-- Migration 038: limite por item de complemento
-- O formulario de complementos ja envia este campo, mas a migration 032
-- adicionou apenas os limites da lista em categorias_complementos.

ALTER TABLE complementos
  ADD COLUMN IF NOT EXISTS qtd_max INTEGER NOT NULL DEFAULT 99;

COMMENT ON COLUMN complementos.qtd_max IS
  'Quantidade maxima permitida deste complemento por item do pedido';

NOTIFY pgrst, 'reload schema';
