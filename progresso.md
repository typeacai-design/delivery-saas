# Progresso do We Delivery — 2026-09-01

## Rodada: Subseções Pedidos + Avaliações

### Subseções em Pedidos
- ✅ FluxoTab.tsx: pedidos em andamento (novo, preparando, pronto, saiu)
- ✅ HistoricoTab.tsx: pedidos concluídos (entregue, cancelado)
- ✅ Tabs visuais no topo da página de pedidos
- ✅ Fluxo: filtros por status e data, grid de cards compactos
- ✅ Histórico: métricas (entregues, cancelados, faturamento), busca por cliente/código
- ✅ Tabela responsiva no histórico com ações rápidas

### Página de Avaliações Melhorada
- ✅ Cards de métricas melhorados (nota média, total, positivos, negativos)
- ✅ Gráfico de distribuição visual com barras coloridas
- ✅ Filtros por status (Todas, Pendentes, Aprovadas)
- ✅ Filtros avançados por nota (1-5 estrelas)
- ✅ Badge de tipo de avaliação (Excelente 🌟, Ótimo 😊, Regular 😐, Ruim 😕, Péssimo 😞)
- ✅ Integração com WhatsApp para contatar cliente diretamente
- ✅ UI mais visual com avatares e cores
- ✅ Link para Avaliações no menu lateral (SidebarNav)
- ✅ Removido redirect de /avaliacoes para /marketing

### Correções gerais aplicadas
- ✅ Status da loja com horário configurável
- ✅ Botões 2x3 nos cards de pedido
- ✅ Exibir desconto no card
- ✅ Remover "Em Aberto", unificar com "Novo"
- ✅ Filtro de data De/Até
- ✅ Excluir vs inativar produtos
- ✅ Remover horário disponível do cadastro de produto
- ✅ Busca de complementos por nome e descrição
- ✅ Slug sem hífen (apenas letras/números)

## Rodada integrada e publicada

- Identidade Classic com seis cores HEX, tipografias Clássica/Moderna/Minimalista, tokens CSS, preview, logo, banner e imagens de complementos.
- Duas faixas de comunicação, animações acessíveis e atalhos coerentes por Sessão.
- Fluxo completo de complementos, carrinho e checkout tematizado/acessível, com aniversário, CPF opcional, entrega/retirada, pagamentos, troco, resumo, WhatsApp e histórico seguro.
- Financeiro, Gestão, Marketing, Equipe, entrega por bairro/distância/mapa, perfil/slug e seleção de tenant ativo.
- Pedido, estoque e cupom transacionais com idempotência; convites com token hash e membership somente no aceite.
- RLS endurecida: nenhum acesso anônimo direto a pedidos ou itens; dashboard limitado a membros ativos do tenant.
- Migrations `043`–`046` aplicadas. Deploy `dpl_3iG8ciu6Kr8KC4871NsLWSuW8z2C`, alias `https://wedelivery.site`, build 88/88 e smoke HTTP 200.

## Pendências da rodada

- Configurar `MAPBOX_ACCESS_TOKEN` para cálculo por km; sem ele há bloqueio controlado.
- Configurar `RESEND_API_KEY` quando necessária para convite de conta existente.
- Painéis/permissões específicos de Cozinha e Motoboy; transição de status via RPC; limpeza de `rate_limits`; histórico cross-device; layouts Moderno/Minimalista; warnings de middleware/Cache-Control; testes E2E visuais e funcionais reais.

Detalhes: `docs/checkpoints/2026-08-12-sessao-cardapio-operacao.md`.

## Implementado no código

- Landing em `/`; painel do lojista em `/dashboard`; CTAs conectados a `/registro` e `/login`.
- Metadados globais, identidade visual e rotas públicas/auth separadas.
- Uploads de logo, banner, produtos e complementos, com migrations de Storage correspondentes.
- Personalização pública por layout e paleta.
- Fluxo de produto por listas ordenadas de complementos, regras mínimas/máximas, observações, carrinho e checkout.
- Entrega ou retirada, meios de pagamento habilitados, troco, resumo e WhatsApp.
- Sprint 5: gestão de motoboys, atribuição/comissão, avaliação por pedido e exibição pública.
- Sprint 6: embaixadores, indicações/comissões, campanhas e cupons de sorteio.

## Pendências operacionais

- Implementar painéis dedicados e matriz de permissões efetiva para os acessos `Cozinha` e `Motoboy`. Nesta etapa o CRUD restringe os papéis disponíveis, mas a experiência específica de cada função ainda é uma entrega futura.

- Confirmar em cada ambiente remoto se as migrations `037` a `041` foram aplicadas.
- Confirmar os buckets `logos`, `produtos`, `cardapio-assets` e `complementos` e suas políticas.
- Preencher as variáveis descritas em `.env.local.example` no ambiente, sem versionar valores.
- Executar regressão manual: cadastro → configuração visual → produto/complementos → cardápio → entrega/retirada → pagamento → pedido → WhatsApp → motoboy → avaliação → sorteio.
- Homologar em preview antes de qualquer publicação em produção.

## Critérios de conclusão

1. `pnpm run check:setup`, `pnpm exec tsc --noEmit` e `pnpm run build` passam.
2. Landing abre em `/` e login aprovado termina em `/dashboard`.
3. As migrations e os buckets são confirmados no ambiente alvo.
4. O roteiro de regressão acima passa em celular e desktop.

Este arquivo registra o estado do código. Ele não afirma que mudanças locais já foram publicadas ou aplicadas no Supabase.


## 2026-09-09 - Reference-price correction

Fix deployed after explicit authorization: wedelivery.site now uses dpl_7NehPjynkyVYmZKKN5NCiSvTXESi (code f16b5ba, baseline 4aaafe6). Verified on mobile and desktop; no database changes. See docs/sessions/2026-09/2026-09-09-preco-a-partir-de.md.
