-- Migration 077: Trigger para unificar clientes automaticamente
-- OBJETIVO: Impedir duplicacao de clientes com mesmo (tenant_id, telefone)
-- LOGICA: Antes do INSERT, busca cliente existente e atualiza em vez de criar novo

-- ============================================================
-- 1. Limpar duplicatas existentes (fazer ANTES do trigger)
-- Para cada grupo (tenant_id, telefone), manter o mais antigo e desativar os outros
-- ============================================================
WITH duplicados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, telefone
      ORDER BY created_at ASC
    ) as rn
  FROM clientes
  WHERE ativo = true AND telefone IS NOT NULL
),
para_desativar AS (
  SELECT id FROM duplicados WHERE rn > 1
)
UPDATE clientes
SET ativo = false,
    observacoes = COALESCE(observacoes || E'\n', '') ||
                  '[unificado automaticamente em ' || NOW()::timestamp::text || ']'
WHERE id IN (SELECT id FROM para_desativar);

-- ============================================================
-- 2. Criar funcao que unifica antes de inserir
-- ============================================================
CREATE OR REPLACE FUNCTION public.unificar_cliente_antes_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cliente_existente_id UUID;
  telefone_normalizado TEXT;
BEGIN
  -- Normalizar telefone (apenas digitos)
  telefone_normalizado := REGEXP_REPLACE(NEW.telefone, '[^0-9]', '', 'g');

  -- Se telefone vazio, deixa inserir (campos opcionais sao permitidos)
  IF telefone_normalizado IS NULL OR LENGTH(telefone_normalizado) < 10 THEN
    NEW.telefone := telefone_normalizado;
    RETURN NEW;
  END IF;

  -- Buscar cliente ativo existente com mesmo (tenant_id, telefone)
  SELECT id INTO cliente_existente_id
  FROM public.clientes
  WHERE tenant_id = NEW.tenant_id
    AND REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = telefone_normalizado
    AND ativo = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  -- Se encontrou cliente existente, atualiza ao inves de inserir
  IF cliente_existente_id IS NOT NULL THEN
    -- Atualizar dados do cliente existente com informacoes mais recentes
    UPDATE public.clientes
    SET
      nome = COALESCE(NULLIF(TRIM(NEW.nome), ''), nome),
      endereco = COALESCE(NULLIF(NEW.endereco, ''), endereco),
      numero = COALESCE(NULLIF(NEW.numero, ''), numero),
      complemento = COALESCE(NULLIF(NEW.complemento, ''), complemento),
      cpf = COALESCE(NULLIF(NEW.cpf, ''), cpf),
      data_nascimento = COALESCE(NEW.data_nascimento, data_nascimento),
      bairro = COALESCE(NULLIF(NEW.bairro, ''), bairro),
      acesso_token_hash = COALESCE(NEW.acesso_token_hash, acesso_token_hash),
      updated_at = NOW()
    WHERE id = cliente_existente_id;

    -- Retornar o cliente existente em vez de inserir novo
    SELECT * INTO NEW FROM public.clientes WHERE id = cliente_existente_id;
    RETURN NEW;
  END IF;

  -- Nao encontrou duplicata - normalizar telefone e inserir
  NEW.telefone := telefone_normalizado;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Criar trigger que executa antes do INSERT
-- ============================================================
DROP TRIGGER IF EXISTS trg_unificar_cliente_insert ON public.clientes;
CREATE TRIGGER trg_unificar_cliente_insert
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.unificar_cliente_antes_insert();

-- ============================================================
-- 4. Relatorio
-- ============================================================
DO $$
DECLARE
  total_ativos INTEGER;
  total_dup_desativados INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_ativos FROM clientes WHERE ativo = true;
  SELECT COUNT(*) INTO total_dup_desativados
  FROM clientes
  WHERE ativo = false
    AND observacoes LIKE '%unificado automaticamente%';

  RAISE NOTICE 'Migration 077 aplicada';
  RAISE NOTICE 'Clientes ativos: %', total_ativos;
  RAISE NOTICE 'Duplicatas desativadas automaticamente: %', total_dup_desativados;
END $$;
