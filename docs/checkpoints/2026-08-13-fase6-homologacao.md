# Fase 6 — homologação final (2026-08-13)

## Veredito estrito

**PASS técnico controlado — não declarar prontidão comercial absoluta ainda.**

O backup local pré-migrations \`artifacts/db-backup/pre-migrations.dump\` foi criado e validado. As migrations \`047–050\` foram aplicadas em produção e o verificador remoto passou, validando 101 policies, 17 tabelas, 15 funções e 4 buckets. O deployment final está \`Ready\` no alias https://wedelivery.site. Build, typecheck, testes e smokes HTTP passaram. E2E real em navegador/mobile, regressão visual e lint amplo permanecem pendentes antes de declarar prontidão comercial absoluta.

Não foram registradas credenciais, senhas, tokens ou hashes neste checkpoint.

## Evidências automatizadas

| Verificação | Resultado |
|---|---:|
| pnpm test | PASS — 12/12 |
| pnpm exec tsc --noEmit | PASS |
| pnpm build | PASS — 88 páginas |
| Verificadores de Fases 3 e 4 | PASS |
| pnpm lint | PENDENTE — dívida de lint amplo |
| Playwright/E2E browser | NÃO EXECUTADO |

## Supabase e deploy

- Backup local pré-migrations: \`artifacts/db-backup/pre-migrations.dump\`, criado e validado.
- Migrations \`047–050\`: aplicadas em produção, em ordem.
- Verificador remoto: **PASS** — 101 policies, 17 tabelas, 15 funções e 4 buckets.
- Deployment final: **Ready**, alias https://wedelivery.site.
- Smokes HTTP de produção: **PASS** para páginas públicas, bloqueio admin sem sessão, APIs protegidas e rotas de diagnóstico.
- Credenciais de gerenciamento não são persistidas neste relatório.

## Pendências mínimas antes do PASS comercial

1. Rotacionar externamente os segredos sinalizados no checkpoint de segurança.
2. Reduzir/triagem do lint amplo.
3. Preparar staging e contas de teste para admin, lojista, cozinha e motoboy.
4. Instalar/configurar Playwright e executar jornadas E2E reais de admin, lojista e cliente.
5. Fazer regressão visual/interativa real em desktop, Android e iPhone, especialmente aniversário e marquee contínuo.

## Checklist

- [x] Backup local e rollback revisados.
- [x] Migrations 047–050 aplicadas em ordem e verificadores remotos em PASS.
- [x] Deployment final e smoke HTTP de produção em PASS.
- [ ] Segredos externos rotacionados.
- [ ] Lint amplo sem erros.
- [ ] E2E autenticado em staging.
- [ ] Pedido, PIX, WhatsApp, retirada e entrega homologados ponta a ponta.
- [ ] Regressão visual em desktop, Android e iPhone aprovada.

Artefatos:
- runbook da migration 047: docs/runbooks/migration-047-rls.md
- migration 047: supabase/migrations/047_consolidar_rls_multitenant.sql
- verificador remoto da RLS: scripts/verify-rls-047.js
## Atualização pós-rotação

- Secret key nova configurada na Vercel como confidencial em Produção.
- Chave legada de serviço revogada após deploy de validação.
- Deploy Ready: dpl_cad5EGrR8Ya3jxczohshkqXLM8nh, alias https://wedelivery.site.
- Smokes pós-rotação: admin 401, diagnósticos 404, cardápio/login 200.
- Próximo passo: simulação manual do usuário; E2E browser/mobile e lint amplo continuam pendentes.

## Atualização — correção do login do lojista (13/08/2026)

- Diagnóstico confirmado pelos logs: POST `/api/auth/login` retornava 200, `/dashboard` retornava 200 e `/api/auth/session` retornava 200, mas a sessão do painel não encontrava os dados da loja.
- Causa: `/api/auth/session` fazia `select('*')` em `tenants`; após as RLS 047–050, a consulta ampla não era compatível com as colunas autorizadas e o layout redirecionava para `/login`.
- Correção: sessão agora consulta somente `id`, `nome` e `status`, valida tenant ausente com 403; fluxo de aprovação também usa sessão server-side e associação real `usuarios_loja`.
- Validação local: `pnpm exec tsc --noEmit` e `pnpm build` passaram; 88 páginas geradas.
- Publicação: deployment `dpl_6phlyu7s2`/alias `https://wedelivery.site` Ready. Nenhuma migration, alteração de banco ou credencial foi feita nesta correção.
- Próximo teste manual: abrir `/login`, usar `Ctrl+Shift+R` e testar com o lojista aprovado `typeacai@gmail.com`. Se ainda falhar, registrar a mensagem exibida e o horário para correlação nos logs.
