# Segurança e prontidão — checkpoint de 2026-08-13

## Veredito da auditoria

O We Delivery não está totalmente pronto para contratos. O cardápio e fluxos básicos funcionam, mas a auditoria encontrou APIs admin abertas, RLS perigosa, diagnósticos expostos, ausência de testes e papéis operacionais incompletos. A exposição administrativa foi corrigida na Fase 1; as demais etapas permanecem.

## Fase 1 e revisões independentes

A Fase 1 preserva o acesso total do administrador e bloqueia visitantes:

- sessão HttpOnly assinada com segredo dedicado, e-mail exato e expiração;
- autenticação antes de qualquer uso de `service_role`;
- rate limit persistente por IP + e-mail;
- Proxy Next 16, layout e server component como defesa em profundidade;
- 401 tratado centralmente pela UI;
- diagnósticos bloqueados; `senhaHash` filtrado; PUT com allowlist;
- login admin legado removido do login comum;
- `Perfil e segurança` no menu, identidade de login somente leitura e troca de senha separada.

Revisões independentes encontraram fallbacks inseguros, middleware duplicado, rate limit em memória, hash exposto, estados vazios enganosos e credenciais em scripts. Os achados foram corrigidos e validados.

## Produção

- Deploy: `dpl_6m4sJNdWsSxfgHuuabNXinki55p2`.
- Alias: `https://wedelivery.site`.
- APIs administrativas sem sessão: HTTP 401.
- `/api/debug/cookies`, `/api/diagnostico/session`, `/api/test-login` e `/teste`: HTTP 404.
- Configurações administrativas sem sessão: HTTP 307 para login.

## Senha, segredos e limpeza

O usuário forneceu uma nova senha, mas seu valor nunca deve ser repetido ou persistido. Ela ainda deve ser aplicada pela UI em `Perfil e segurança`.

PATs e credenciais literais foram removidos dos scripts; scripts de migração/diagnóstico agora exigem ambiente e não imprimem valores. `env.production.txt` foi excluído. Um `ADMIN_SESSION_SECRET` local aleatório existe somente no `.env.local` ignorado.

Tratar como comprometidos e rotacionar antes da liberação: senha admin, segredo de sessão de produção, Supabase PAT/access token, `service_role`, OIDC e outros tokens de provedores que tenham aparecido em arquivos/histórico. A limpeza local não equivale à rotação; nenhuma rotação externa ocorreu.

## Fase 2 — criada, não aplicada

Artefatos locais:

- `supabase/migrations/047_consolidar_rls_multitenant.sql`;
- `scripts/verify-rls-047.js`.

Não foram aplicados nem publicados. Três patches são mandatórios antes do uso:

1. Tornar idempotentes os `DROP POLICY` de `storage.objects`, cobrindo nomes/variantes existentes.
2. Corrigir a inspeção de privilégio `PUBLIC` no verificador usando `aclexplode`.
3. Declarar grants/revokes explícitos para as assinaturas nomeadas de cada RPC, especialmente funções sobrecarregadas.

Depois: revisão SQL, backup, homologação, verificador read-only, testes Loja A/Loja B e papéis; só então produção.

## Fases 3–6

### Fase 3 — papéis

Owner completo na própria loja; Cozinha limitada à produção; Motoboy às entregas; autorização no servidor; testes de escalada e acesso cruzado.

### Fase 4 — qualidade operacional

Triar lint por risco; corrigir autenticação, checkout, PIX, mapas, histórico, cadastro e avaliações; concluir ou ocultar recursos “em construção”; padronizar ambientes.

### Fase 5 — automação

Testes unitários, integração e E2E de admin, lojista, cliente e funcionários em staging; isolamento entre lojas e idempotência.

### Fase 6 — homologação

Regressão desktop, Android e iPhone; pedido, PIX, WhatsApp, retirada e entrega; homologação manual e novo veredito de prontidão.

## Bloqueadores conhecidos

- Migration 047 sem os três patches e sem aplicação.
- Rotação externa pendente.
- Cozinha/Motoboy e isolamento entre lojas não homologados.
- Sem staging e suíte E2E completa.
- Dívida de lint e fluxos operacionais não homologados.
- Marquee mobile e aniversário no checkout aguardam validação real.

Este checkpoint não contém segredos, não aplica migrations, não altera dados remotos, não faz deploy e não cria commit.
