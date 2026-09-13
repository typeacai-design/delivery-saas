# Divisao em sabores - 2026-09-09

Status: publicado em producao. Banco e aplicativo verificados em 2026-09-09. Nenhuma loja foi ativada automaticamente.

## Implementacao

Commit de implementacao: `2d46c2f` (`feat: add opt-in pizza flavor selection and proportional pricing`).

A loja pode habilitar divisao em sabores nas configuracoes e escolher, no produto, uma lista existente e limite de dois ou tres sabores. O cliente escolhe a quantidade e exatamente esse numero de sabores distintos. O preco e a media dos precos integrais dos sabores, com arredondamento deterministico em centavos; demais adicionais sao somados normalmente. Base e variantes nao sao somadas nessa modalidade. Pedido manual, edicao, carrinho, impressao, acompanhamento, historico e WhatsApp recebem a composicao salva.

## Banco e compatibilidade

Migration `083_divisao_sabores.sql` aplicada via API em transacao. Contagens e hashes comparados dentro da mesma transacao confirmaram preservacao de tenants, produtos, pedidos e pedido_itens existentes, excluindo somente os novos campos da comparacao. Confirmados tres campos com defaults `false`, `null` e `2`; duas novas RPCs; RPC publica existente restrita a service_role junto com as novas RPCs. Nenhuma loja foi ativada e nenhum produto foi convertido automaticamente. Nenhum registro de teste persistiu.

O smoke SQL anterior executou a migration e exercitou configuracao, vinculos, permissoes, arrays de pagamento, snapshot, falha atomica de criacao/edicao e concorrencia, encerrando com rollback. Confirmacao posterior encontrou zero campos/RPCs/fixtures temporarios.

## Verificacao

- 51 testes automatizados aprovados, incluindo regressao de preco a partir de e credenciais locais.
- Build de producao e TypeScript aprovados, 97 paginas.
- 18 cenarios locais de interface publica e 5 administrativos aprovados antes da proibicao posterior de uso do navegador. Nenhum navegador foi usado depois dessa restricao.
- Verificacao HTTP em `2026-09-09T17:58:07.213Z`: `/`, `/login`, `/cardapio/cozinhadacris`, `/cozinhadacris`, `/cardapio/typeacai` e `/typeacai` responderam 200. Os cardapios da Cris mantiveram o indicador de preco a partir de; Type Acai permaneceu sem esse indicador.
- `/api/configuracoes/sabores` respondeu 401 sem autenticacao, como esperado.
- Doze bundles JavaScript publicados foram conferidos; o fluxo de escolha e a regra `media_v1` estao presentes.
- Nenhum pedido real foi criado para verificacao de producao. As verificacoes finais usaram somente APIs/HTTP, sem navegador.

## Deployments

- Deployment publicado: `dpl_3RauGZrDLUy46bZkGX54Dn5zz6fq`.
- URL do deployment: https://delivery-saas-2vyigzfyl-delivery-saas1.vercel.app.
- Promocao concluida; alias `wedelivery.site` confirmado apontando para `dpl_3RauGZrDLUy46bZkGX54Dn5zz6fq`.
- SHA-256 da arvore verificada no deployment: `7d439e6691addc60bd82daf0bf8e075f97232c6353fcf5371ee0e150a95762c9`.
- Deployment anterior para reversao do aplicativo: `dpl_7NehPjynkyVYmZKKN5NCiSvTXESi`.

Manter migration aditiva e snapshots se reverter aplicativo; nao remover campos nem transformar pedidos gravados. A nova funcionalidade permanece inicialmente desligada. Se produtos forem configurados posteriormente, desative explicitamente esses produtos antes de restaurar codigo antigo: somente desligar a flag nao impede o deployment anterior de somar os adicionais integralmente. Consulte o runbook de contencao.

## Limites

Sabores com controle de estoque e produtos com variantes nao podem ser configurados para divisao. Para cada tamanho, usar um produto. Aumentar a quantidade de uma pizza historica revalida disponibilidade/configuracao; quando o produto controla estoque, a edicao bloqueia o aumento e orienta lancar unidades extras em novo pedido. Reducoes e alteracoes de dados do cliente preservam o snapshot. Sabores sao distintos e divididos igualmente; nao ha repeticao para representar dois tercos de um mesmo sabor.

Acesso Supabase por API usa credencial local cifrada com DPAPI em `C:/Users/ranie/delivery-saas/.credentials/supabase.json`; o arquivo e ignorado no Git e no deploy. Nenhuma credencial deve ser copiada para documentacao ou evidencias.

Referencias: `docs/runbooks/divisao-em-sabores.md`, `docs/ACESSO_API_LOCAL.md`. Evidencias privadas locais em `.local-validation/sql083-production-{baseline,apply,verification}.json` e `.local-validation/sql083-smoke-api-result.json`.


## Estado do repositorio

O codigo da implementacao e o registro desta liberacao estao versionados localmente; a copia principal foi sincronizada por fast-forward com `feat/divisao-sabores` ate `3cc513c`. A publicacao Vercel foi concluida diretamente a partir do codigo validado. Nao houve push ao GitHub nesta liberacao: a revisao automatica bloqueou o envio e a confirmacao explicita solicitada ainda nao havia sido recebida no fechamento. Isso nao desfaz a publicacao Vercel nem a migration aplicada.

Evidencia HTTP final: `.local-validation/production-smoke.json`. As evidencias locais sao ignoradas no Git/deploy; este registro conserva os resultados e identificadores necessarios para operacao.
