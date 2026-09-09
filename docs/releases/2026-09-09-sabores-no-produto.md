# Sabores configurados no produto — 09/09/2026

Status: **publicado em produção**, com banco e aplicativo verificados por API/HTTP.

## Comportamento entregue

Commit de implementação: `e6bd94b3fe299266430824b657e78bf6d11f0d10`.

O lojista configura sabores inteiramente no popup de cadastro/edição do produto: marca a divisão, escolhe a lista e define o máximo de dois ou três sabores. A aba separada Sabores em Configurações foi removida. Não é necessário habilitar previamente a loja; ao salvar validamente um produto configurado, o banco habilita o suporte técnico somente na loja desse produto, na mesma transação. Cancelar não grava alterações. Produtos comuns não ativam a função, e desmarcar um produto não desliga os demais.

O seletor mostra **título — descrição interna**, ou somente título quando a descrição está vazia. O ID e o título público permanecem iguais; a descrição interna da lista não passa a ser exibida no cardápio. Esta entrega não altera a serialização preexistente nem descrições individuais de complementos.

A regra de preço permanece: média dos preços integrais dos sabores, substituindo a base do produto, com extras integrais. Fluxo do cliente, limites, snapshots históricos e as proteções da entrega 083 permanecem.

## Banco

Migração `084_sabores_ativacao_no_produto.sql` aplicada via API após teste com rollback. O trigger posterior ao salvamento habilita apenas o tenant do produto, depois das validações 083 e de permissões. Não há conversão de produtos ou ativação de lojas em massa.

A verificação de produção confirmou hashes preservados das quatro tabelas existentes, um trigger e uma função correspondentes, sem permissão pública de execução e sem fixtures persistentes. Pedidos existentes não foram recalculados.

## Verificação

- 51 testes automatizados aprovados; TypeScript e build de produção aprovados, com 97 rotas.
- Seis cenários administrativos aprovados em Chromium local isolado com fixtures sintéticas, sem acessar o navegador/perfil pessoal do usuário.
- Verificação final em `2026-09-09T20:15:31.328Z` usando `https://wedelivery.site`, publicamente e sem bypass: `/`, `/login`, `/cardapio/cozinhadacris`, `/cozinhadacris`, `/cardapio/typeacai`, `/typeacai`, `/cardapio` e `/configuracoes` responderam 200.
- Os dois caminhos da Cozinha da Cris mantiveram o indicador de preço a partir de.
- `/api/configuracoes/sabores` respondeu 401 JSON sem autenticação, como esperado. Seu endpoint de leitura continua atendendo os fluxos de pedidos.
- Quatorze bundles administrativos conferidos: instruções novas e descrição com trim presentes; bloqueio antigo por configuração da loja e toggle global ausentes.
- A verificação final foi HTTP/API. Não foi uma sessão visual autenticada de produção e não utilizou o navegador pessoal.

## Deployment e reversão

- Deployment publicado: `dpl_DdaU82QKSEmHvBKu9puSNqDQ9exD`.
- URL: https://delivery-saas-pashhzbv7-delivery-saas1.vercel.app.
- Alias de produção confirmado: `wedelivery.site`.
- Deployment anterior preservado: `dpl_3RauGZrDLUy46bZkGX54Dn5zz6fq`, da [entrega 083](2026-09-09-divisao-sabores.md).

O aplicativo anterior continua entendendo os snapshots 083, mas volta a exibir a ativação separada. Uma reversão de interface não apaga a migração 084: a habilitação transacional ao salvar produto continua no banco. Antes de reverter, avalie essa combinação e confirme os produtos afetados. Não remova pedidos, snapshots ou colunas para reverter a interface. Para deployments anteriores à funcionalidade de sabores, siga as precauções adicionais do [runbook](../runbooks/divisao-em-sabores.md).

## Registro local

Evidência sanitizada: `.local-validation/ui084-production-smoke.json`. Artefatos e credenciais permanecem excluídos do Git e da Vercel. O código está commitado localmente; não houve push ao GitHub nesta entrega. A publicação Vercel foi realizada diretamente do código verificado.
