-- Nomes de clientes sempre com a primeira letra de cada palavra maiúscula ("João Da Silva").
-- Vale para qualquer origem (cardápio público, painel, unificação por telefone).
-- O trigger roda antes de trg_unificar_cliente_insert (ordem alfabética), então a unificação já recebe o nome formatado.

CREATE OR REPLACE FUNCTION public.formatar_nome_proprio(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE WHEN p_nome IS NULL THEN NULL
    ELSE pg_catalog.initcap(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_nome), '\s+', ' ', 'g')))
  END
$$;

CREATE OR REPLACE FUNCTION public.clientes_formatar_nome()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.nome := public.formatar_nome_proprio(NEW.nome);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_formatar_nome ON public.clientes;
CREATE TRIGGER trg_clientes_formatar_nome
  BEFORE INSERT OR UPDATE OF nome ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.clientes_formatar_nome();

-- Padroniza os nomes já cadastrados.
UPDATE public.clientes
SET nome = public.formatar_nome_proprio(nome)
WHERE nome IS DISTINCT FROM public.formatar_nome_proprio(nome);
