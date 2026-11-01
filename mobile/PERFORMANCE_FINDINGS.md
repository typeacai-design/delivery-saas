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
