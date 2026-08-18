# We Delivery — Conversas

## CHECKPOINT — 2026-08-18 (bug encoding + modal sessão)

- Build limpa (`pnpm tsc --noEmit` sem erros) e deploy em produção: `https://delivery-saas-d5e7k20rv-delivery-saas1.vercel.app` (alias `wedelivery.site`).
- **Bug encoding corrigido** em `src/app/(dashboard)/cardapio/page.tsx`: double-encoding de 2 níveis (Latin-1 → UTF-8) deixado pelo Codex. Substituições aplicadas:
  - `Ã§` → `ç`, `Ã£` → `ã`, `Ãµ` → `õ`, `Ã£es` → `ões`, `Ã§Ãµes` → `ções`, `Ã§Ã£` → `ção` (todos os níveis que apareceram)
  - `Ãâ` → `—` (em-dash)
  - Em `src/app/api/admin/tenants/route.ts`: 32 substituições em comentários de código (não estava visível na UI, mas era lixo do Codex)
- **Modal "Criar Nova Sessão" reescrito** no padrão do modal "Criar Nova Lista de Complementos" (do `ComplementosTab.tsx`):
  - `ModalShell`: header com título grande + botão X
  - Body: label "Nome *" + input com placeholder + texto de sugestão
  - Footer: botão "Cancelar" (cinza) + "Criar sessão" (preto, com ícone Save)
- **Limpado lixo do Codex**:
  - 3 blocos `false && ...` removidos (botão Nova categoria, modal de tipo, lista de categorias de atalho)
  - 1 comentário corrompido "Modal novo/editar produto ââ" → "Modal novo/editar produto —"
  - `showTipoModal` ainda declarado mas nunca usado (warning TS, não erro)
- **Final do arquivo reconstruído**: o script Node removeu além do que devia na primeira tentativa (corrompendo o JSX entre o header e o fechamento `</div></main>`). Adicionei de volta: estado vazio + lista de categorias com `ProdutoLinha` + modal do produto (com `showCatModal` refeito + estado vazio + lista de produtos). TypeScript compila limpo.
- **Removido `useCoverflowAutoscroll` se houver redundância** — não toquei, mantém o mesmo do projeto 7X-NATURAL (hooks compartilhados funcionando).

**Como retomar:**
- Estado: Sprint 4 concluído, **próximo natural é Sprint 5 (Motoboys + Avaliações)**.
- Pendências operacionais do checkpoint 2026-08-12 (continuam valendo):
  - `MAPBOX_ACCESS_TOKEN` para km
  - `RESEND_API_KEY` quando necessária pra convite de conta existente
  - Painéis/permissões Cozinha/Motoboy
  - Status via RPC
  - Limpeza de `rate_limits`
  - Histórico cross-device
  - Layouts Moderno/Minimalista
  - Testes E2E visuais e funcionais reais

## CHECKPOINT DE RETOMADA — 2026-08-12 (ajustes de design)

Consultar `docs/checkpoints/2026-08-12-ajustes-design-retomada.md`.


## CHECKPOINT DE RETOMADA — 2026-08-12 (cardápio e operação)

- Produção: `https://wedelivery.site`, deploy `dpl_3iG8ciu6Kr8KC4871NsLWSuW8z2C`.
- Migrations `043` a `046` aplicadas; build com 88 páginas e smoke HTTP 200.
- Entregue nesta rodada: tema HEX/fontes/Classic, comunicação e sessões, checkout/histórico/CPF, módulos operacionais, entrega bairro/km/mapa, perfil/slug, multi-loja, pedido atômico, convites e hardening RLS.
- Dependências pendentes: `MAPBOX_ACCESS_TOKEN` para km e, conforme o fluxo do provedor, `RESEND_API_KEY` para convite de conta existente.
- Roadmap: painéis/permissões de Cozinha/Motoboy, status via RPC, limpeza de rate limits, histórico cross-device, layouts futuros e E2E real.
- Documento detalhado: `docs/checkpoints/2026-08-12-sessao-cardapio-operacao.md`.

## CHECKPOINT DE RETOMADA — 2026-08-12

Estado salvo antes de reiniciar o Codex:

- Todo o código está em `C:\Users\ranie\.claude\PROJETOS\delivery-saas`.
- Produção está em `https://wedelivery.site`, deployment `dpl_DKmgjdKjCbhsqJutYL2N8QsbnVuv` (`READY`).
- Último build local e build Vercel passaram com 75 rotas e TypeScript sem erros.
- Correções desta sessão: sessão do login do lojista; coluna `complementos.qtd_max`; RLS/leitura server do cardápio público; conflito do middleware raiz com `/cardapio/[slug]`.
- Migrations novas aplicadas em produção: `038_complementos_qtd_max.sql` e `039_cardapio_leitura_publica.sql`.
- Teste final real: `https://wedelivery.site/cardapio/typeacai` respondeu 200 sem redirecionamento e exibiu `Copo de 300ml`.
- Ao retomar: ler este arquivo, `CLAUDE.md` e as skills do projeto; continuar deste ponto, sem reconstruir ou desfazer as correções.

## Sessão 2026-08-12 — Produtos no cardápio público

- **Sintoma**: produtos ativos cadastrados pelo lojista não apareciam em `/cardapio/[slug]`.
- **Causa 1**: as policies RLS só permitiam leitura com `tenant_id = auth.uid()`, retornando listas vazias para clientes anônimos.
- **Causa 2**: havia dois middlewares; o middleware raiz considerava todo caminho iniciado por `/cardapio` privado e redirecionava `/cardapio/typeacai` para `/login`.
- **Correção**: migration 039 criou leitura anônima restrita a lojas/itens ativos; a página server passou a usar service role; o middleware raiz foi alinhado à sessão atual e preserva a proteção HMAC do admin com Web Crypto.
- **Validação em produção**: `/cardapio/typeacai` respondeu 200 sem redirect, casou com `/cardapio/[slug]` e renderizou 1 de 1 produto público.
- **Deploy**: `dpl_DKmgjdKjCbhsqJutYL2N8QsbnVuv`, alias `https://wedelivery.site`.

## Sessão 2026-08-11 — Correção ao salvar complementos

- **Sintoma**: `Could not find the 'qtd_max' column of 'complementos' in the schema cache`.
- **Causa raiz**: o formulário já enviava `qtd_max`, mas a migration 032 criou apenas `qtd_minima/qtd_maxima` em `categorias_complementos` e não criou o limite individual em `complementos`.
- **Correção**: migration 038 adicionou `complementos.qtd_max INTEGER NOT NULL DEFAULT 99` e solicitou reload do schema PostgREST.
- **Validação**: coluna confirmada em `information_schema` e consulta REST ao campo respondeu HTTP 200.

## Sessão 2026-08-11 — Correção do login do lojista

- **Sintoma**: credenciais eram aceitas, mas o lojista não conseguia concluir a entrada no painel.
- **Causa raiz**: a página `/login` usava `createBrowserClient` diretamente, enquanto o layout do dashboard usava `@/lib/supabase/client` com a chave de armazenamento `wedelivery-auth`. A sessão era gravada em um local e lida em outro.
- **Correção**: `/login` passou a usar o mesmo `createClient()` compartilhado pelo dashboard.
- **Validação**: build local e builds de preview/produção passaram com 75 rotas; preview respondeu HTTP 200.
- **Produção**: deploy `dpl_5UYPaw7VbPpGGcyEcgqFqy8qq3Tt`, alias atualizado em `https://wedelivery.site`.

## Sessão 2026-08-12 (Sprints 1-4 + salvamento completo)

URLs atuais (mais recentes após cada sprint):
- **Produção (última Sprint 4)**: https://delivery-saas-l6wfaeq9l-delivery-saas1.vercel.app
- **Domínio**: https://wedelivery.site
- Admin: `/painel-admin/login` (credenciais mantidas apenas no ambiente seguro)
- Lojista de teste: credenciais removidas; usar somente o ambiente seguro.
- Supabase: identificadores e tokens removidos; usar variáveis de ambiente.

---

## Sprint 1 — Bugs do PDF + produtos limpos (2026-08-12)

### Bug 1 — Complemento não aparece após salvar
**Causa raiz**: o botão "Adicionar complemento" chamava `setEditingComp(null)` e logo `setEditingComp({ categoria_id: lista.id } as any)` no mesmo batch — o React mantinha o objeto parcial sem ID, deixando o modal confuso.

**Fix**:
- Novo state `compParaNovaListaId` em `ComplementosTab.tsx`, separado do `editingComp`
- Botão: `setEditingComp(null) + setCompParaNovaListaId(lista.id) + setShowCompModal(true)`
- Try/catch no `salvar()` com `alert()` se der erro
- Delay de 200ms antes do `loadData()` pra evitar race condition

### Bug 2 — Linha de produto cheia demais
**Antes**: foto / nome / descrição / tempo / ID / ordem / valor / pontos / complementos / controle de estoque / ações (≈12 colunas)
**Depois** — novo componente `ProdutoLinha.tsx`:
- 📷 Foto + Título **editável inline** (clica, edita, Enter salva, Esc cancela)
- Etiquetas coloridas: Mesa (amarelo) / Delivery (azul) / Retirada (roxo)
- Chip "X complementos" (quantidade dos vinculados)
- **Ordem** editável inline + **Preço** editável inline
- **Pontos** (badge verde, se >0)
- Ações: Editar / Duplicar / Switch Ativar-Desativar / Apagar

Estado novo em `cardapio/page.tsx`: `complementosPorProduto: Record<string, any[]>` carregado via query em `produto_complementos`.

**Build**: ✓ 1.4s, 69 rotas. URL: `delivery-saas-l6wfaeq9l`

---

## Sprint 2 — Matéria-prima (2026-08-12)

Conceito: lojista cadastra "ingredientes" na aba Estoque (Pão, Queijo, Carne... com custo, unidade, estoque). Quando cadastra o Hambúrguer X, vincula os ingredientes com **quantidade por unidade do produto**. Ao confirmar pedido, baixa estoque automaticamente.

### Migration 034 aplicada
- Tabela `produto_ingredientes` (vincula produto ↔ insumo com quantidade por unidade)
- RLS + índices
- Reusa a tabela `insumos` existente (nome, unidade, custo_unitario, quantidade_atual, estoque_minimo)

### Matéria-prima CRUD (sub-aba em Estoque)
Nova aba **"Matéria-prima"** dentro de `/dashboard/gestao` (ao lado de "Estoque" e "Entradas/Saídas"):
- Lista com nome, unidade, custo unitário, estoque atual vs mínimo
- Aviso vermelho "Estoque baixo" quando `quantidade_atual <= estoque_minimo`
- Valor total em estoque (qtd × custo)
- CRUD: nome / unidade (g, kg, ml, l, un) / custo / estoque atual / mínimo
- Sub-aba acessada via ícone Boxes

### Card "Ingredientes" no produto
Novo card no `ProdutoFormModal` (último card antes do footer):
- Lista de ingredientes vinculados com select + input de quantidade + unidade (do insumo)
- Botão "+ Adicionar ingrediente" (dashed border)
- **Custo total por unidade** calculado em tempo real (`soma(qtd × custo_unitário)`)
- Botão X em cada linha pra remover
- Salva sincronizando vínculos (delete + insert) ao salvar produto

### Baixa automática de estoque
Implementado em **dois endpoints** (cliente final + lojista) — `/api/pedidos/public` e `/api/pedidos`:
1. Pega `produto_ids` do pedido
2. Busca ingredientes vinculados em massa
3. Acumula baixa por insumo (`qtd_item × quantidade_por_produto`)
4. Aplica `update` em `insumos.quantidade_atual` (não deixa negativo)
5. Loga movimentação em `movimentacoes_estoque` (tipo='saida')

Falha silenciosa — não bloqueia o pedido se matéria-prima falhar.

**Build**: ✓ 6.1s, 69 rotas.

---

## Sprint 3 — Clientes (CRM) (2026-08-12)

### Migration 035 aplicada
Novas colunas em `clientes`:
- `email, observacoes, tags TEXT[], ativo, opt_in_whatsapp, ltv DECIMAL, primeiro_pedido_em`
- `total_pedidos, ultimo_pedido_em` (alguns não existiam, adicionados também)
- 2 índices (busca por telefone + ordenação por último pedido)

### Trigger `trg_pedido_atualiza_cliente`
A cada pedido inserido/atualizado, recalcula automaticamente em `clientes`:
- `ltv` = soma dos `valor_total` dos pedidos não cancelados
- `total_pedidos` = contagem
- `ultimo_pedido_em` = data do pedido atual
- `primeiro_pedido_em` = data do primeiro (não sobrescreve)

### Página `/dashboard/clientes`
Nova rota com CRM:
- **Header**: botão "Exportar" (CSV) + "Novo cliente"
- **Cards métrica**: Total ativos / LTV médio / Novos 30d / Top 3 mais fiéis
- **Filtros**: busca (nome/telefone/email) + filtro tag + ativo/inativo
- **Tabela**: Cliente (com email, data nasc) / Telefone clicável (wa.me) / Tags coloridas / Pedidos / LTV / Último pedido (relativo) / Ações
- **Modal de cadastro** com 3 cards: Identificação / Endereço / Tags & Observações, mais toggles "Cliente ativo" e "Aceita WhatsApp". Upsert por telefone (não duplica).

### Sidebar
Adicionado link "Clientes" entre Pedidos e Cardápio (ícone Users).

**Build**: ✓ 2.1s, 70 rotas.

---

## Sprint 4 — Marketing/Fidelidade + Visitantes (2026-08-12)

### Migration 036 aplicada
- **`cliente_pontos`**: nova tabela (tenant_id, cliente_id, pontos_saldo, pontos_acumulados_total)
- **`saldo_cashback`**: nova coluna em `clientes`
- **`page_views`**: nova tabela (analytics por tenant)
- **Trigger `atualizar_metricas_cliente`** reescrito:
  - Lê config do tenant pra fidelidade e cashback
  - Calcula `pontos = valor_subtotal × pontos_por_real`
  - Calcula `cashback = valor_total × cashback_percent/100`
  - Credita no `cliente_pontos` (upsert) e `clientes.saldo_cashback`
  - Filtra pedidos cancelados (`WHEN NEW.status IS DISTINCT FROM 'cancelado'`)

### Painel Marketing (3 novas abas)

**Fidelidade (`FidelidadeTab.tsx`)**:
- Toggle "Pontos por real gasto" + input "Pontos por R$1"
- Toggle "Cashback em %" + input "%"
- Salva em `tenant.config.{fidelidade_ativo, pontos_por_real, cashback_ativo, cashback_percent}`

**Disparo WhatsApp (`DisparoTab.tsx`)**:
- Filtros: Todos / VIP / Novos / Inativos (>30d) / Aniversariantes
- Editor de mensagem com botões de variáveis: `{{nome}}`, `{{telefone}}`, `{{ultimo_pedido}}`, `{{total_pedidos}}`, `{{saldo_cashback}}`
- Lista com botão "Disparar" → abre `wa.me/55xxx?text=mensagem_pronta` em nova aba

**Carrinho Abandonado (`CarrinhoAbandonadoTab.tsx`)**:
- Lista de `carrinho_salvo` com `updated_at < agora-24h`
- Mostra qtd itens + valor estimado + há quanto tempo
- Botão "Recuperar" abre WhatsApp com mensagem-tipo

### Visitantes (analytics)
- **API** `POST /api/track-view` — conta visita (1x por sessão via `sessionStorage`)
- **API** `GET /api/analytics?periodo=24h|7d|30d|all` — total + série por dia
- **Card "Visitantes"** no `/dashboard/relatorios`: badges de período (24h/7d/30d/Tudo) + mini-gráfico de barras verticais
- Pluga automaticamente no cardápio público via `useEffect` em `cardapio-cliente.tsx`

**Build**: ✓ 2.4s, 72 rotas (2 novas APIs: track-view, analytics).

---

## Resumo de credenciais e referências

- **Admin**: acesso configurado por variáveis de ambiente; não registrar credenciais neste arquivo.
- **Lojista (Type Açaí)**: credenciais removidas; usar somente o ambiente seguro.
- **Tenant ID**: 1396a259-0217-4d26-b819-fd8a15d18dea
- **Supabase Project**: iqacuakyyzhrsrjzlnai
- **PAT** (Management API): removido; usar somente o ambiente seguro.
- **Vercel token**: salvo em %APPDATA%\com.vercel.cli\Data\auth.json

## Migrations aplicadas (33-036)

| # | Tabela/Mudança | Sprint |
|---|---|---|
| 031 | produto_campos_instadelivery (22 campos em produtos) | Pré-S1 |
| 032 | complementos_campos_extra (qtd_min/max, etiquetas, custo, estoque) | Pré-S1 |
| 033 | preco_riscado + etiquetas em produtos | Pré-S1 |
| 034 | produto_ingredientes (matéria-prima) | S2 |
| 035 | clientes CRM (email, tags, ltv, observacoes) | S3 |
| 036 | fidelidade (cliente_pontos), cashback, page_views | S4 |

## Funcionalidades entregues (até Sprint 4)

1. ✅ Auth admin com cookie HttpOnly HMAC
2. ✅ Cardápio público + checkout anônimo com PIX
3. ✅ Cardápio: produtos + categorias + complemento + upsert
4. ✅ Multi-usuário (4 roles: owner/manager/atendente/entregador)
5. ✅ Onboarding wizard + Tour guiado
6. ✅ Mensalidades + Pagamento PIX
7. ✅ Pedidos com WhatsApp
8. ✅ Desconto aniversário automático
9. ✅ Horário bloqueia pedido
10. ✅ Multi-tenant com Supabase RLS
11. ✅ Modal de criar/editar produto estilo AnotaAI
12. ✅ Etiquetas no produto (Promoção, Mais vendido, Novidade)
13. ✅ Preço riscado
14. ✅ Sub-aba Matéria-prima + baixa automática no pedido
15. ✅ CRM de Clientes (filtros, tags, exportação CSV)
16. ✅ Fidelidade: pontos por real + cashback % automáticos
17. ✅ Disparo WhatsApp manual por público filtrado
18. ✅ Carrinho abandonado (+24h)
19. ✅ Visitantes (page-views) com gráficos

## Próximas sprints (planejado)

- **Sprint 5**: Motoboys (CRUD + atribuição em pedido) + Avaliações (1-5 estrelas + painel admin)
- **Sprint 6**: Embaixadores (link de indicação + comissão) + Sorteios (cupom da sorte + sorteio aleatório)

---

## Histórico de URLs deployadas

| Data | URL | Motivo |
|---|---|---|
| 2026-08-11 | `delivery-saas-k261ugby7` | Auth admin refactor |
| 2026-08-11 | `delivery-saas-7qfnf9jeu` | Resolução loop login |
| 2026-08-11 | `delivery-saas-kts0meb1j` | Modal produto com abas (InstaDelivery) |
| 2026-08-11 | `delivery-saas-d6qfwzrtl` | Preço riscado + Etiquetas |
| 2026-08-11 | `delivery-saas-dg2revf47` | Layout AnotaAI + Listas de complemento |
| 2026-08-11 | `delivery-saas-l6wfaeq9l` | Sprint 1 — bug fix + linha limpa |
| 2026-08-12 | (mesmo do Sprint 1) | Sprint 2/3/4 deployaram no mesmo |

Todas as URLs server-side via `--prod` na Vercel usando auth.json persistido.
# Sessão 2026-08-12 — execução consolidada

- A landing existente foi integrada à raiz `/`; a visão geral autenticada passou para `/dashboard`, mantendo as demais rotas do painel.
- CTAs apontam para `/registro` e `/login`; o login aprovado redireciona para `/dashboard`.
- Metadados globais foram atualizados para `wedelivery.site` com suporte a `NEXT_PUBLIC_SITE_URL`.
- O README deixou de conter credenciais em texto puro e passou a documentar migrations `037`–`041`, buckets e validação local.
- Foi criado `pnpm run check:setup`, que verifica somente nomes de variáveis e arquivos locais, sem imprimir segredos ou consultar produção.
- Estado remoto continua exigindo validação explícita antes do deploy; nenhuma migration ou publicação foi feita nesta etapa.
