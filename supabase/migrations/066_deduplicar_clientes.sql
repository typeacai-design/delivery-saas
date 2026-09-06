-- Dedup clientes duplicados por telefone. O bug acontecia porque o
-- cardapio-cliente.tsx nao persistia o accessToken no localStorage
-- apos o cadastro, entao a cada reload/dispositivo novo o cliente
-- era cadastrado novamente com um token diferente.
--
-- Esta migration nao deleta os duplicados (preserva auditoria);
-- apenas os marca adicionando sufixo [dup-AAAAMMDDHH24MI] no nome.
-- O registro mais antigo de cada (tenant_id, telefone) permanece
-- como primario.
--
-- Correcao definitiva esta em src/components/cardapio-cliente.tsx
-- (commit 4xyz): onClienteCadastrado agora salva no localStorage
-- imediatamente, evitando novos duplicados.

DO $$
DECLARE
  r RECORD;
  v_merged INT := 0;
BEGIN
  FOR r IN (
    SELECT tenant_id, telefone, COUNT(*) as qtd
    FROM clientes
    WHERE telefone IS NOT NULL AND telefone <> ''
    GROUP BY tenant_id, telefone
    HAVING COUNT(*) > 1
  ) LOOP
    UPDATE clientes cli
    SET nome = cli.nome || ' [dup-' || to_char(now(),'YYYYMMDDHH24MI') || ']'
    WHERE cli.tenant_id = r.tenant_id
      AND cli.telefone = r.telefone
      AND cli.id NOT IN (
        SELECT id FROM clientes
        WHERE tenant_id = r.tenant_id AND telefone = r.telefone
        ORDER BY created_at ASC
        LIMIT 1
      );
    v_merged := v_merged + 1;
  END LOOP;

  RAISE NOTICE 'Grupos de duplicatas marcados: %', v_merged;
END $$;
