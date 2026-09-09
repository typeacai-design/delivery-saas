# Divisão em sabores: uso e liberação

## Para o lojista

**Migração 084 e interface publicadas, verificadas via API/HTTP.** A configuração passa a ficar inteiramente no popup de cadastro/edição do produto. A aba Sabores em Configurações foi removida nessa revisão. Na versão inicial 083, a ativação separada da loja era necessária; essa instrução foi substituída pelo fluxo abaixo.

A função continua opcional por produto. Marcar a opção e cancelar não grava nada. Ao salvar validamente um produto configurado, o banco habilita o suporte técnico de sabores somente para a loja desse produto, na mesma transação. Nenhum outro produto é convertido e não há ativação em massa de lojas.

1. Na área de complementos, cadastre uma lista com os sabores. O preço de cada opção deve ser o da **pizza inteira daquele tamanho**. Não cadastre preços de meia pizza ou de um terço.
2. Abra **Cardápio → cadastrar/editar produto**. No popup, localize **Divisão em sabores**, ative a montagem, escolha a lista e o máximo de **2 ou 3 sabores**. Confira a prévia e salve.
3. Teste a montagem no cardápio e no lançamento manual antes de divulgar o produto.

Na lista suspensa, as opções mostram **título — descrição interna** para distinguir listas com o mesmo título. Quando não há descrição, aparece somente o título. Isso altera apenas a identificação no painel: o identificador salvo e o título público continuam iguais; a descrição interna da lista não é exibida no fluxo público. Essa revisão não altera a serialização preexistente dos dados nem a descrição individual dos complementos.

Use produtos separados para Pizza Pequena, Média e Grande. Se os preços dos sabores mudam conforme o tamanho, use uma lista por tamanho. A quantidade de sabores não exige listas diferentes: a mesma lista atende pizza inteira, duas metades e três terços.

| Produto | Lista | Máximo |
| --- | --- | --- |
| Pizza Pequena | Sabores Pequena | 2 |
| Pizza Média | Sabores Média | 2 |
| Pizza Grande | Sabores Grande | 3 |

Bordas e outros extras devem ficar em outras listas. Não misture esses adicionais na lista escolhida como Sabores, pois todas as opções dessa lista representam sabores inteiros.

## Fluxo da compra e regra de preço

O cliente escolhe a pizza, informa **1, 2 ou 3 sabores** dentro do máximo configurado, seleciona **exatamente essa quantidade de sabores distintos** e segue para os outros adicionais. Pode voltar para mudar a quantidade; nesse caso a seleção anterior é limpa para evitar uma montagem incoerente. As partes são iguais. Não há seleção repetida de um sabor para representar dois terços.

**Pizza = soma dos preços integrais selecionados / quantidade de sabores.**

| Seleção | Valor da pizza |
| --- | --- |
| Calabresa 30 | R$ 30,00 |
| Calabresa 30 + Frango 36 | R$ 33,00 |
| Calabresa 30 + Frango 36 + Portuguesa 39 | R$ 35,00 |
| Três sabores acima + borda de 8 | R$ 43,00 |
| Duas pizzas iguais com três sabores e borda | R$ 86,00 |

A média **substitui o preço-base do produto**, tanto em produtos anteriormente fixos quanto nos marcados como “A partir de”. Os outros adicionais são somados integralmente. A quantidade de pizzas multiplica o valor unitário final. Entrega, desconto e acréscimo continuam sendo aplicados ao pedido. O cálculo usa centavos e arredonda a média uma vez; o divisor é a quantidade escolhida, não o máximo permitido.

No cardápio, o preço “a partir de” da pizza configurada vem do menor preço dos sabores disponíveis. O atendente utiliza a mesma montagem no lançamento manual. Carrinho, pedido, impressão, mensagem e histórico mostram os sabores com a fração `1/2` ou `1/3` quando aplicável.

## Restrições e desativação por produto

- Produtos com variantes não aceitam divisão: mantenha um produto por tamanho.
- Sabores com `controlar_estoque` ativado não podem ser utilizados nesta modalidade. A divisão de preço não implementa baixa fracionada de ingredientes.
- O estoque da pizza inteira e de extras continua sujeito às regras do sistema. Para aumentar a quantidade de uma pizza com estoque controlado em um pedido **já salvo**, lance as unidades adicionais em **um novo pedido**; a edição bloqueia esse aumento para preservar a baixa de estoque.
- A flag técnica da loja permanece para compatibilidade e contingência, sem tela separada de ativação. Se ela for desligada por operação administrativa autorizada, os produtos configurados ficam indisponíveis para novas compras. Não passam silenciosamente a somar os sabores pelo preço integral. A configuração permanece salva.
- Para converter uma pizza em produto comum, desmarque a divisão no popup e revise explicitamente seu preço e suas listas antes de salvar. Isso não desliga a função nos demais produtos da loja. Produtos comuns continuam com suas regras fixas ou “a partir de”.
- Pedidos já recebidos mantêm seus preços e composições. Mudar somente endereço, observação ou status não atualiza os preços históricos.
- Carrinhos abertos são revalidados ao carregar. Se o preço/composição de uma pizza mudou, a pizza precisa ser montada novamente, com aviso ao cliente.

## Contrato técnico

A migração `supabase/migrations/083_divisao_sabores.sql` adiciona configuração opt-in e proteções. `tenants.sabores_ativo` inicia `false`; `produtos.sabores_grupo_id` inicia vazio, com `sabores_maximo` limitado a 2/3 quando configurado. Sabores permanecem em `complementos`, ligados pelo cadastro existente. O pedido guarda a composição no JSON de complementos; não depende do cadastro atual para renderizar o histórico.

A migração `supabase/migrations/084_sabores_ativacao_no_produto.sql` acrescenta ativação transacional da flag técnica ao salvar um produto com sabores. Mantém as validações 083, permissões e limites; o endpoint de leitura da flag continua disponível para os fluxos de pedidos. Não cria conversões em massa. A aplicação 084 foi verificada com hashes das quatro tabelas preservados, trigger/função conferidos e sem fixtures persistentes; a publicação da interface foi confirmada no [registro da liberação 084](../releases/2026-09-09-sabores-no-produto.md).

O cliente envia `sabores_quantidade` de 1 a 3 por item e `quantidade` de pizzas separadamente. Cada sabor tem `quantidade: 1`, nunca `0.5` ou `0.333`. O snapshot guarda:

```json
{
  "id": "id-do-complemento",
  "nome": "Calabresa",
  "quantidade": 1,
  "valor": 15,
  "tipo": "sabor",
  "grupo_id": "id-da-lista",
  "fracao_denominador": 2,
  "preco_integral": 30,
  "regra_preco": "media_v1"
}
```

`valor` é a parcela alocada em centavos, compatível com a soma atual dos complementos; `preco_integral` registra o valor da pizza inteira. O servidor consulta tenant, produto, vínculos, lista e preços novamente e reconstrói o snapshot. Não confia em `valor`, nome, grupo ou fração enviados pelo navegador. Em pedidos manuais com sabores, subtotal e total são reconstruídos; desconto, entrega e acréscimo são campos explícitos.

## Liberação e verificação

Este documento descreve o procedimento e o comportamento publicado; consulte a [liberação 084](../releases/2026-09-09-sabores-no-produto.md) para as evidências finais.

**Acesso operacional desta entrega:** use as APIs/CLI autorizadas. O usuário revogou o uso de seu navegador: não acesse seu Chrome, perfil ou autenticação pelo navegador. Os testes locais isolados com fixtures sintéticas não usam esse perfil e podem ser utilizados quando a verificação de código exigir. Siga [Acesso local às APIs](../ACESSO_API_LOCAL.md): o loader lê a credencial Supabase cifrada por DPAPI na pasta `.credentials` canônica, também utilizada pelas worktrees. Não copie nem imprima tokens. A Vercel utiliza o cache autenticado oficial da CLI/API.

**Evidência registrada antes da publicação:** 51 testes automatizados passaram (incluindo 3 de credenciais), build com 97 rotas concluído e teste SQL da migração 083 via API concluído com rollback. O teste SQL não deixou linhas/schema temporários. Os 18 cenários de interface pública e 5 administrativos foram executados anteriormente, antes da restrição de acesso ao navegador do usuário; essas evidências não equivalem a uma verificação visual da versão publicada. A migração 083 foi aplicada via API e verificada: hashes dos dados existentes preservados, três colunas e permissões corretas, flags inicialmente desligadas. A entrega 083 foi publicada e está registrada em [liberação 083](../releases/2026-09-09-divisao-sabores.md). A migração 084 foi aplicada e verificada; a nova interface está publicada no deployment `dpl_DdaU82QKSEmHvBKu9puSNqDQ9exD`, com alias `wedelivery.site` verificado em `2026-09-09T20:15:31.328Z`.

1. Registre commit, versão de produção anterior na Vercel e estado do banco. Preserve pedidos e alterações locais existentes.
2. Revise e teste a migração em ambiente isolado, incluindo permissões, gravação transacional, estoque e isolamento entre lojas. Não ative lojas ou produtos automaticamente.
3. Execute `npm test`, `npx tsc --noEmit` e `npm run build`. Confira `git diff --check`.
4. Os scripts `node scripts/verify-flavor-ui.mjs` e `node scripts/verify-flavor-admin.mjs` documentam os testes visuais reproduzíveis. Eles usam Chromium isolado e fixtures sintéticas, sem acessar o Chrome/perfil do usuário. Não há necessidade de repeti-los nesta etapa, pois já passaram e não houve nova alteração de código. Quando necessários, execute-os sequencialmente, sem build/dev concorrente na mesma pasta. Eles usam fixtures locais; a verificação pública usa Supabase simulado, bloqueia escrita/requests externos e remove a rota temporária ao terminar. O Playwright pode ser indicado por `PLAYWRIGHT_RUNTIME`.
5. Aplique a migração revisada via API mantendo os defaults desligados. Confira o resultado por consulta somente de leitura. Publique via Vercel CLI/API e valide o preview com requisições HTTP antes de promover produção, conforme a autorização de deploy.
6. Verifique cardápios existentes, produto fixo, produto “a partir de”, pedido manual, pedidos antigos, impressão e pagamento. Confira que nenhuma loja foi habilitada implicitamente.
7. Configure e salve somente o produto combinado para o primeiro uso; sua loja será habilitada tecnicamente nesse salvamento. Confira uma, duas e três partes, borda, duas pizzas diferentes do mesmo tamanho, histórico e impressão antes de ampliar a utilização.

As evidências ficam em `.local-validation/`, ignorada pelo Git e pela Vercel. Os scripts e fixtures permanecem versionados. Não publique rotas temporárias de validação, logs nem credenciais.

## Contenção e reversão

O deployment anterior da Vercel deve permanecer disponível para reversão; registre seu identificador/URL no registro da liberação. Com todas as flags desligadas e nenhum produto convertido, a migração aditiva permite voltar ao código anterior sem remover dados.

Se já houver pizzas configuradas/vendidas, prefira desligar a função mantendo o código novo, que continua interpretando os snapshots. **Antes de restaurar um deployment antigo, deixe explicitamente inativos os produtos configurados afetados e valide os fluxos antigos**: o código anterior não entende a flag de sabores e pode voltar a cobrar pela soma integral. Não dependa apenas da flag desligada para essa reversão.

Não apague colunas, snapshots ou pedidos para reverter a interface. Preserve a leitura de pedidos já recebidos, o registro do incidente e a possibilidade de reativar os produtos após a correção.
