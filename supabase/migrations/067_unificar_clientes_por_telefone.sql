-- 067_unificar_clientes_por_telefone.sql
--
-- Resolve o problema de clientes duplicados por telefone que continua
-- aparecendo mesmo apos a migration 066.
--
-- Causa raiz: a identificacao do cliente no checkout e feita por
-- `acesso_token_hash` (token aleatorio gerado no frontend). Cada
-- dispositivo / navegador gera um token diferente, e a funcao
-- `criar_pedido_atomico` (e o endpoint /api/clientes/public) busca
-- cliente apenas por esse hash -- nao por telefone. Resultado:
-- o mesmo cliente fisico em 2 dispositivos vira 2 registros.
--
-- Esta migration:
-- 1) Cria a funcao RPC `buscar_ou_unificar_cliente(tenant, telefone,
--    novo_token_hash)` que, ao ser chamada, busca o cliente primario
--    (mais antigo por created_at) com mesmo (tenant, telefone). Se
--    existir, transfere o token novo para o primario, move os pedidos
--    dos duplicados para o primario, e desativa os duplicados.
-- 2) Aplica a unificacao retroativa para todos os duplicados que
--    existem HOJE no banco (paralelo a migration 066, mas agora
--    alem de renomear tambem desativa e move pedidos).
--
-- Grants: service_role, anon, authenticated (igual a 065).

-- ===========================================================================
-- PARTE 1: funcao RPC reutilizavel
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.buscar_ou_unificar_cliente(
  p_tenant_id uuid,
  p_telefone text,
  p_novo_token_hash text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_primario_id UUID;
  v_dup_ids UUID[];
BEGIN
  -- Sem telefone, nao ha o que unificar
  IF p_telefone IS NULL OR btrim(p_telefone) = '' THEN
    RETURN NULL;
  END IF;

  -- Normaliza telefone (apenas digitos)
  p_telefone := regexp_replace(p_telefone, '\D', '', 'g');
  IF p_telefone = '' THEN
    RETURN NULL;
  END IF;

  -- Trava os registros deste grupo para evitar race condition entre
  -- dois pedidos simultaneos do mesmo cliente em dispositivos diferentes.
  SELECT array_agg(id ORDER BY created_at ASC)
    INTO v_dup_ids
  FROM clientes
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(coalesce(telefone,''), '\D', '', 'g') = p_telefone
  FOR UPDATE;

  IF v_dup_ids IS NULL OR array_length(v_dup_ids, 1) IS NULL THEN
    -- Nenhum cliente com esse telefone ainda. Caller deve inserir.
    RETURN NULL;
  END IF;

  IF array_length(v_dup_ids, 1) = 1 THEN
    -- Apenas 1 registro (o primario). Se veio token novo, vincula.
    v_primario_id := v_dup_ids[1];
    IF p_novo_token_hash IS NOT NULL
       AND p_novo_token_hash <> ''
       AND NOT EXISTS (
         SELECT 1 FROM clientes
         WHERE id = v_primario_id
           AND acesso_token_hash = p_novo_token_hash
       ) THEN
      UPDATE clientes
        SET acesso_token_hash = COALESCE(acesso_token_hash, p_novo_token_hash)
        WHERE id = v_primario_id;
    END IF;
    RETURN v_primario_id;
  END IF;

  -- Mais de 1 registro: pega o mais antigo como primario e desativa o resto.
  v_primario_id := v_dup_ids[1];

  -- Atualiza o token do primario se:
  -- - caller passou um novo token
  -- - primario NAO tem token (cliente que perdeu o localStorage)
  -- - OU caller pediu para forcar (sempre, exceto se primario ja tem um
  --   token E caller NAO mandou novo -- nesse caso mantemos o existente)
  IF p_novo_token_hash IS NOT NULL
     AND p_novo_token_hash <> ''
     AND NOT EXISTS (
       SELECT 1 FROM clientes
       WHERE id = v_primario_id
         AND acesso_token_hash = p_novo_token_hash
     ) THEN
    UPDATE clientes
      SET acesso_token_hash = p_novo_token_hash
      WHERE id = v_primario_id;
  END IF;

  -- Move pedidos dos duplicados para o primario
  UPDATE pedidos
    SET cliente_id = v_primario_id
    WHERE cliente_id = ANY(v_dup_ids)
      AND cliente_id <> v_primario_id
      AND tenant_id = p_tenant_id;

  -- Desativa os duplicados (mantem o registro para auditoria)
  UPDATE clientes
    SET ativo = false
    WHERE id = ANY(v_dup_ids)
      AND id <> v_primario_id;

  -- Recalcula total_pedidos / ultimo_pedido_em do primario
  UPDATE clientes c
    SET total_pedidos = sub.qtd,
        ultimo_pedido_em = sub.ultimo
    FROM (
      SELECT cliente_id,
             COUNT(*)::int AS qtd,
             MAX(created_at) AS ultimo
      FROM pedidos
      WHERE cliente_id = v_primario_id
        AND tenant_id = p_tenant_id
      GROUP BY cliente_id
    ) sub
    WHERE c.id = sub.cliente_id;

  RETURN v_primario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_ou_unificar_cliente(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_ou_unificar_cliente(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.buscar_ou_unificar_cliente(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.buscar_ou_unificar_cliente(uuid, text, text) TO authenticated;

-- ===========================================================================
-- PARTE 2: unificacao retroativa de duplicados existentes
-- ===========================================================================

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN (
    SELECT tenant_id, regexp_replace(telefone, '\D', '', 'g') AS tel
    FROM clientes
    WHERE telefone IS NOT NULL
      AND telefone <> ''
      AND (ativo = true OR ativo IS NULL)
    GROUP BY tenant_id, regexp_replace(telefone, '\D', '', 'g')
    HAVING COUNT(*) > 1
  ) LOOP
    -- Chama a funcao sem passar token novo (preserva o token do primario
    -- que ja existe, se houver). Apenas desativa os duplicados e move
    -- pedidos.
    PERFORM public.buscar_ou_unificar_cliente(r.tenant_id, r.tel, NULL);
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Grupos de duplicados unificados: %', v_count;
END $$;
