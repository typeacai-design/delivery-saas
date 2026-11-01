# Lentidão ao abrir e trocar de abas

Análise de 31/10/2026. Foram consultados código, região do projeto, estatísticas do PostgreSQL e avisos de desempenho. Não foram feitas otimizações, criados índices ou reiniciadas estatísticas.

## Causas sustentadas por evidência

1. **As abas recarregam ao serem abertas.** No app, `Merchant` desmonta a tela anterior; `useRemote` não mantém cache entre montagens. Voltar à mesma aba repete consultas. Atualizações periódicas e eventos de pedidos também podem recarregar dados da aba aberta.
2. **Há várias chamadas para uma única operação.** `checkStore` verifica usuário, vínculo e loja em sequência, antes de consultar/salvar o conteúdo. APIs do site também repetem a verificação de sessão e vínculo. A latência de cada viagem se acumula.
3. **Algumas telas carregam o histórico inteiro.** Financeiro busca pedidos, despesas e movimentações; o catálogo busca todas as páginas de produtos, inclusive seções recolhidas. Esse comportamento cresce junto com o uso.
4. **O site tem consultas adicionais por pedido.** O carregamento de pedidos consulta históricos/contagens por cliente. Esse padrão aumenta a quantidade de solicitações à medida que cresce a lista.
5. **O banco está em `us-west-2`, no oeste dos EUA.** Essa distância pode aumentar o tempo de comunicação para lojistas no Brasil. A localização foi confirmada; seu impacto exato no aparelho ainda não foi medido.

## O que as medições do banco dizem

- Consulta frequente de pedidos: 12.608 execuções; média de **5,81 ms** de execução SQL.
- Outra consulta de valores/status: 633 execuções; média de **3,84 ms**.
- Atualizações de status/pagamento observadas: médias entre aproximadamente **34 e 49 ms**.
- O assessor de desempenho também identificou chaves estrangeiras sem índice, que merecem revisão por plano de execução.

Esses tempos **não incluem** conexão, autenticação, API, transferência dos dados, imagens ou desenho da tela. Portanto, não demonstram que o banco, sozinho, explique a demora percebida. Índices não devem ser criados indiscriminadamente.

## Próxima investigação recomendada

Medir uma troca real de aba em aparelho, separando sessão, API, SQL, bytes transferidos e renderização. Depois priorizar cache por loja com invalidação correta, carregamento por período/seção, menos chamadas repetidas e eliminação de consultas por item. Só então avaliar índices e eventual mudança de região. Imagens grandes são uma hipótese adicional, ainda sem medição.

## Alterações de segurança feitas separadamente

Mesas e dias de pico estavam com RLS desabilitado. As políticas agora limitam o acesso à própria loja e aos perfis apropriados. Duas leituras de colunas operacionais foram liberadas sem SELECT geral, e o perfil privado usa funções com verificação explícita de proprietário/gerente, loja ativa e bloqueio. CPF, e-mail e demais colunas privadas não receberam permissão geral. Essas mudanças não são otimizações de desempenho.

O cadastro de equipe reutiliza a API já existente. Foi identificada nessa API uma implementação antiga de armazenamento de senha sem hash criptográfico; ela merece correção com compatibilidade no login operacional. Não há senha de equipe em consultas, logs ou armazenamento persistente do aplicativo.


## Applied in Android 0.3.1 — 1 November 2026

- Session-local cache, explicitly keyed by tenant and filters, destroyed on logout. The four main tabs mount lazily and retain their state; hidden tabs defer refreshes. Cache deduplicates simultaneous reads, keeps confirmed data during background refresh, and rejects obsolete in-flight responses.
- Native Finance now calls read-only `mobile_financeiro`: all-time totals computed inside Postgres, 50 cashflow/account records per page, optional list date range. The previous financeSummary totals/dedup/expense predicates are deliberately preserved; paging does not change totals. Existing historical accounting inconsistencies are not silently redefined by this performance patch.
- `mobile_inicio` returns the same month/day dashboard aggregates and public store config in one request instead of downloading all month orders. Array-valued payment methods retain the effective previous `pago=true` revenue rule.
- Both RPCs are STABLE SECURITY INVOKER with empty search_path, explicit owner/manager + active/unblocked tenant guard, existing RLS/column ACL, no anonymous execute, no table grants/writes. Production migration `20261101125417_mobile_read_performance` is additive; website routes and deployment are unchanged.
- Product/category reads start together; mutation membership/tenant checks run concurrently after server identity validation, without authorization caching.
- Successful status/payment writes update cached order cards and counts after server confirmation. No optimistic financial success and no automatic mutation retry. Busy feedback and synchronous press lock prevent accidental repeat submissions. Existing website status endpoint remains authoritative; its own latency has not been removed or benchmarked.
- Realtime fetches the changed order rather than all app sections. Ambiguous counts or paginated gaps trigger only relevant list reconciliation. The 30-second fallback refreshes the visible primary section; new-order alerts retain their separate foreground tracker.
- Initial Finance loading no longer claims an empty ledger. Background errors retain data with an explicit error; a different filter never shows the preceding filter's result.

Validation: unit/cache/React hook/SQL tests; 1,203 synthetic orders for all-time parity and complete paginated cashflow; active/inactive/foreign/anonymous/blocked access; production read-only smoke checked summary, bounded page and isolation using the authenticated role. No real order mutation used for verification. No on-device stopwatch results claimed; compare this APK with the supplied recordings on the same device.
