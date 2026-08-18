# Progresso We Delivery — 2026-08-13

## Veredito

**PASS técnico controlado — ainda não declarar prontidão comercial absoluta.** O backup local pré-migrations foi criado e validado, as migrations \`047–050\` foram aplicadas em produção, o verificador remoto de RLS passou e o deployment final está \`Ready\`. Build, typecheck, testes e smokes HTTP passaram. Permanecem pendentes E2E real em navegador/dispositivo, regressão visual mobile/desktop, lint amplo e rotação operacional de credenciais.

## Fase 1 — concluída e publicada

- APIs administrativas privilegiadas validam sessão antes de usar service_role.
- Sessão usa segredo dedicado, HMAC timing-safe, e rate limit durável.
- Diagnósticos e /teste bloqueados em produção; UI redireciona 401 para login.
- Perfil e segurança foi adicionado ao menu, com troca de senha isolada.
- Scripts e arquivos de ambiente em texto puro foram limpos.

Publicação final: deployment \`Ready\`, alias https://wedelivery.site. Em produção, APIs admin sem sessão retornam 401; diagnósticos e /teste retornam 404; configurações admin sem sessão redirecionam com 307.

## Fase 2 — aplicada e verificada

As migrations \`047\`, \`048\`, \`049\` e \`050\` foram aplicadas em produção, em ordem, após a criação e validação do backup local \`artifacts/db-backup/pre-migrations.dump\`. O verificador remoto passou: 101 policies, 17 tabelas, 15 funções e 4 buckets validados. Nenhuma credencial foi registrada neste documento.

## Situação das Fases 3–6

- Fase 3: autorização server-side e isolamento por loja verificados.
- Fase 4: correções técnicas e contratos de segurança verificados.
- Fase 5: testes locais, typecheck e build aprovados; E2E real de navegador ainda não executado.
- Fase 6: segurança, migrations, deploy e smokes HTTP em PASS técnico controlado.

## Pendências restantes

1. Rotacionar externamente os segredos sinalizados no checkpoint de segurança.
2. Corrigir/triagem do lint amplo.
3. Criar staging/contas e executar E2E autenticado real para admin, lojista e cliente.
4. Fazer regressão visual/interativa em desktop, Android e iPhone, especialmente aniversário e marquee mobile.

## Retomada exata

1. Rotacionar credenciais externas e registrar apenas concluído/não concluído.
2. Corrigir lint e configurar Playwright/staging.
3. Executar E2E e regressão visual.
4. Repetir smokes após qualquer alteração e atualizar o veredito comercial.

Detalhes:
- homologação da Fase 6: docs/checkpoints/2026-08-13-fase6-homologacao.md
- checkpoint de segurança: docs/checkpoints/2026-08-13-seguranca-prontidao.md
- runbook da migration 047: docs/runbooks/migration-047-rls.md
## Atualização final — rotação e simulação do usuário

- A nova Secret key do Supabase foi configurada na Vercel como variável confidencial apenas para Produção.
- A chave legada SUPABASE_SERVICE_ROLE_KEY foi revogada no Supabase após o deploy de validação.
- Novo deploy Ready: dpl_cad5EGrR8Ya3jxczohshkqXLM8nh, alias https://wedelivery.site.
- Smokes pós-rotação: APIs admin 401, diagnósticos 404, cardápio 200 e login 200.
- O usuário iniciará simulação manual do sistema.
- Pendências: E2E real em navegador/dispositivo, regressão visual desktop/mobile e lint amplo.

## Atualização — correção do login do lojista (13/08/2026)

- Diagnóstico confirmado pelos logs: POST `/api/auth/login` retornava 200, `/dashboard` retornava 200 e `/api/auth/session` retornava 200, mas a sessão do painel não encontrava os dados da loja.
- Causa: `/api/auth/session` fazia `select('*')` em `tenants`; após as RLS 047–050, a consulta ampla não era compatível com as colunas autorizadas e o layout redirecionava para `/login`.
- Correção: sessão agora consulta somente `id`, `nome` e `status`, valida tenant ausente com 403; fluxo de aprovação também usa sessão server-side e associação real `usuarios_loja`.
- Validação local: `pnpm exec tsc --noEmit` e `pnpm build` passaram; 88 páginas geradas.
- Publicação: deployment `dpl_6phlyu7s2`/alias `https://wedelivery.site` Ready. Nenhuma migration, alteração de banco ou credencial foi feita nesta correção.
- Próximo teste manual: abrir `/login`, usar `Ctrl+Shift+R` e testar com o lojista aprovado `typeacai@gmail.com`. Se ainda falhar, registrar a mensagem exibida e o horário para correlação nos logs.
