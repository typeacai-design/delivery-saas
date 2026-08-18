# Runbook — migration 047 (RLS multi-tenant)

## Decisões de menor privilégio

`registrar_auditoria` é deliberadamente `service_role`-only. Isto diverge da proposta inicial de liberar `authenticated`: clientes autenticados poderiam fabricar ou adulterar a trilha. O dashboard registra eventos por `POST /api/auditoria`, que valida sessão, loja ativa e papel antes da RPC server-side.

## Pré-condições

1. Executar `node scripts/rls-047/snapshot.js` com `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF`. Sem essas variáveis, o script deve encerrar com “Variável obrigatória ausente”, sem `MODULE_NOT_FOUND`.
2. O snapshot `we-delivery-rls-047-v4` captura RLS/FORCE RLS, policies, ACLs de tabela/coluna/função/schema/sequência, definições de funções e buckets. Guardar `artifacts/rls-047/` fora do Git.
3. Executar `node scripts/rls-047/generate-rollback.js <snapshot.json>` e revisar o SQL gerado por duas pessoas. Confirmar backup PITR e janela de manutenção.
4. Rodar typecheck, lint direcionado e build. Não aplicar se falharem.

## Aplicação controlada

Aplicar `supabase/migrations/047_consolidar_rls_multitenant.sql` pelo mecanismo oficial. Em seguida executar `node scripts/verify-rls-047.js`. Fazer smoke tests de cardápio, owner/manager, kitchen, motoboy, transições de pedido, quatro buckets, PIX, mensalidade, equipe, auditoria e sorteio.

## Critérios de aborto

Abortar se o verificador falhar, qualquer coluna sensível aparecer para anon, uma relação aceitar pais de tenants distintos, um papel atualizar campos integrais de pedidos ou uploads/checkout falharem. Não improvisar grants em produção.

## Rollback restaurável

O gerador produz `artifacts/rls-047/rollback-*.sql` com estado de RLS/FORCE RLS, policies, grants de tabela/coluna e definições/ACLs de funções capturadas. Antes de executar:

1. comparar o SQL com o snapshot e remover qualquer restauração de policy vulnerável que não tenha sido explicitamente aprovada;
2. executar primeiro em clone/staging e rodar smoke tests;
3. em produção, executar o arquivo em transação durante a janela aprovada;
4. repetir snapshot e testes após rollback e registrar o incidente.

O gerador v4 revoga grants extras de PUBLIC, anon, authenticated e service_role e restaura RLS/FORCE RLS, policies, ACLs de tabela/coluna/schema/sequência/função por assinatura exata e triggers capturados. Execute `node scripts/rls-047/self-test.js` antes da janela; o resultado obrigatório é `rollback_self_test=ok`.