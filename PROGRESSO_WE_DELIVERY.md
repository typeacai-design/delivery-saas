# Progresso do We Delivery

Atualizado em 09/09/2026. Este documento registra as alterações concluídas e o contexto necessário para retomar o trabalho com segurança.

## Estado atual

**Sistema publicado em https://wedelivery.site.** A correção de preço “a partir de” e a funcionalidade opcional de divisão em sabores estão implementadas e publicadas. Nenhuma loja foi ativada automaticamente para sabores e nenhum produto existente foi convertido. Os pedidos e demais dados existentes foram preservados.

- Projeto principal para continuar o trabalho: `C:/Users/ranie/delivery-saas`, branch `main`.
- Worktree usado na implementação: `C:/Users/ranie/we-delivery-sabores`, branch `feat/divisao-sabores`.
- Cópia original preservada: `C:/Users/ranie/.claude/PROJETOS/delivery-saas`. Não foi sobrescrita.
- A cópia principal foi sincronizada por fast-forward até `3cc513c`; este documento integra um commit local posterior apenas de documentação.

## Revisão 084 em andamento: configuração somente no produto

**Ainda não confirmar como publicada.** Nesta revisão local, a aba Sabores de Configurações foi removida. O lojista marca a divisão diretamente no popup do produto, escolhe a lista e o limite de dois ou três sabores e salva. O checkbox não exige uma ativação prévia da loja. Cancelar não grava alterações.

A migração `084_sabores_ativacao_no_produto.sql` habilita o suporte técnico de sabores somente na loja do produto salvo validamente, na mesma transação. Não converte outros produtos e não faz ativação em massa. Desmarcar um produto não desliga os outros produtos da loja. Preços, limites, snapshots e as proteções 083 permanecem.

O seletor de listas passa a mostrar **título — descrição interna**, com fallback para apenas título. Os IDs e títulos públicos não mudam; a descrição interna da lista não passa a ser exibida no cardápio. O endpoint de leitura da flag técnica permanece para compatibilidade com os fluxos de pedidos.

Seis testes locais isolados da nova interface, 51 testes automatizados e build de 97 rotas foram aprovados. O teste SQL 084 com rollback também passou. A migração 084 foi aplicada via API e verificada em produção: hashes das quatro tabelas preservados, trigger/função conferidos, sem permissão pública de execução e sem fixtures persistentes. A publicação da nova interface ainda está pendente. Os dados de produção e publicação descritos abaixo referem-se à entrega 083 já concluída.

## 1. Correção de preço a partir de

Identificada com o cliente Cozinha da Cris e corrigida antes da funcionalidade de sabores:

- Produto com preço fixo: cobra base do produto, variação aplicável e adicionais.
- Produto com a opção explícita “preço a partir de”: cobra somente os adicionais; o preço exibido do produto é referência e não entra novamente na cobrança.
- Carrinhos abertos são normalizados ao recarregar; pedidos antigos não são recalculados.

Implementação `f16b5ba`; registro de publicação `e36a6ef`. A verificação anterior confirmou Espaguete com Frango por R$ 27,00 sem duplicar a base. Detalhes: [registro da correção](docs/sessions/2026-09/2026-09-09-preco-a-partir-de.md).

## 2. Divisão da pizza em sabores

Implementação `2d46c2f`; registro da liberação `3cc513c`.

Na entrega 083 publicada, o lojista ativava a função nas configurações da loja; esse passo é substituído pela revisão 084 descrita acima. No popup de cadastro/edição do produto, habilita divisão em sabores, escolhe uma lista existente de complementos e define o máximo de dois ou três sabores. Cada sabor continua com seu preço cadastrado na lista: o valor deve representar a pizza inteira daquele sabor e tamanho. Não é necessário repetir preços no produto ou criar listas separadas para cada quantidade de sabores. Tamanhos com preços diferentes podem usar listas diferentes.

Fluxo do cliente:

1. Escolhe a pizza/tamanho.
2. Escolhe um, dois ou três sabores, conforme o limite daquele produto.
3. Seleciona exatamente a quantidade escolhida, com sabores distintos e partes iguais.
4. Escolhe bordas e outros adicionais comuns.
5. Confere a composição e o total no carrinho antes de concluir.

Cálculo: soma dos preços integrais dos sabores dividida pela quantidade escolhida. Essa média substitui a base do produto; demais adicionais são somados integralmente. Exemplo: Calabresa R$ 30 + Frango R$ 36 = pizza de dois sabores por R$ 33. Com Portuguesa R$ 39, os três sabores custam R$ 35. Borda de R$ 8 leva essa pizza a R$ 43.

A regra é compartilhada entre cardápio e lançamento manual, com validação autoritativa no servidor. Os snapshots guardam nomes, preços integrais, frações e parcelas em centavos com versão `media_v1`. Carrinho, pedido, impressão, acompanhamento, histórico e WhatsApp exibem essa composição.

## Banco de dados e proteções

Migration `supabase/migrations/083_divisao_sabores.sql` aplicada via API após teste transacional com rollback:

- `tenants.sabores_ativo`: `false` inicialmente.
- `produtos.sabores_grupo_id`: `null` inicialmente.
- `produtos.sabores_maximo`: `2` inicialmente, aceitando 2 ou 3.
- Novas RPCs para criação manual e edição atômicas; gravação falha sem deixar pedido parcial.
- RPC pública existente e novas RPCs restritas a `service_role`, impedindo chamadas diretas que contornem a validação dos preços.
- Limites, vínculos e pertencimento à loja verificados no servidor.

Contagens e hashes de tenants, produtos, pedidos e itens foram comparados antes/depois na mesma transação de aplicação e confirmaram preservação dos dados anteriores. Nenhum registro de teste persistiu.

## Validações e publicação

- 51 testes automatizados aprovados, incluindo regressão e credenciais locais.
- Build de produção e TypeScript aprovados, 97 páginas.
- 18 cenários locais da interface pública e 5 administrativos aprovados antes da proibição posterior de uso do navegador.
- Validação final de produção em `2026-09-09T17:58:07.213Z` por HTTP/API: inicial, login e quatro URLs dos cardápios Cris/Type Açaí responderam 200; configuração de sabores respondeu 401 sem autenticação, como esperado.
- Doze bundles publicados conferidos, contendo o fluxo e `media_v1`. Nenhum pedido real foi criado para verificar produção.
- Deployment ativo confirmado: `dpl_3RauGZrDLUy46bZkGX54Dn5zz6fq`, alias `wedelivery.site`.
- Deployment anterior: `dpl_7NehPjynkyVYmZKKN5NCiSvTXESi`.

Evidências sanitizadas selecionadas ficam em `C:/Users/ranie/delivery-saas/.local-validation/`, ignoradas pelo Git e pela Vercel. Incluem resultados do smoke SQL, baseline/aplicação/verificação da migration e smoke HTTP. A evidência original de trabalho permanece na mesma pasta relativa do worktree. Consulte o [registro definitivo da liberação](docs/releases/2026-09-09-divisao-sabores.md).

## Limites e operação segura

- Sabores com controle de estoque não podem ser divididos; não foi introduzido consumo fracionário de estoque.
- Produto configurado para sabores não aceita variantes: usar um produto por tamanho.
- Aumentar quantidade de pizza histórica revalida disponibilidade/configuração, preservando o preço salvo. Se o produto controla estoque, o aumento na edição é bloqueado, com orientação para novo pedido das unidades extras.
- Composição inalterada e dados de cliente/endereco preservam snapshots históricos. Mudança de sabores exige validação atual.
- Ao desligar a função, produtos configurados ficam indisponíveis para novas compras; não retornam silenciosamente à soma integral.
- Antes de restaurar código antigo, desativar explicitamente produtos configurados afetados. Apenas desligar a flag não protege o deployment anterior, que desconhece a nova regra. Não apagar colunas, snapshots ou pedidos para reverter interface.

Guia de uso e contenção: [divisão em sabores](docs/runbooks/divisao-em-sabores.md).

## Credenciais, restrições e pendências

A credencial Supabase fica cifrada com DPAPI do usuário Windows em `C:/Users/ranie/delivery-saas/.credentials/supabase.json`. Usar `scripts/lib/local-credentials.js` por meio de `scripts/lib/supabase-management.js`; não imprimir, copiar para documentos ou commitar segredos. Orientações: [acesso por API](docs/ACESSO_API_LOCAL.md).

**O usuário proibiu o acesso ao navegador pessoal.** Continuar operações autorizadas por APIs e comandos; não reutilizar sessões do navegador. As evidências anteriores de interface não autorizam novo acesso.

O código e documentos estão salvos localmente e a publicação Vercel está concluída. **Não houve push ao GitHub:** a revisão automática bloqueou o envio; a autorização explícita para o destino segue pendente. O pedido de salvar progresso na pasta do projeto não autoriza esse envio externo. Não ativar lojas nem alterar produtos existentes automaticamente ao retomar.


## Registro historico preservado

O conteudo anterior a este checkpoint foi preservado integralmente abaixo. Para o estado atual, prevalecem as secoes de 09/09/2026 acima.

# We Delivery - Progresso do Sistema

## Última Atualização: 07/09/2026 — correção "Pago", UI de complementos

## Deploy em Produção
- **URL**: https://wedelivery.site
- **Repositório**: https://github.com/typeacai-design/delivery-saas
- **Último Deploy**: 07/09/2026 — correção "Pago" + UI complementos
- **Deployment ID**: `dpl_3yR9vwwZuLaoakfz7DjAhZdvbGbQ` (alias `wedelivery.site`)
- **Build**: ✅ Compiled successfully

---

## 📜 Regra de Habilidades e Skills (do CLAUDE.md)

> **TODA HABILIDADE RELEVANTE DEVE SER SALVA.**

Skills já registradas em `.claude/skills/`:
- `deploy-vercel.md` — Como fazer deploy sem erro
- `supabase-client-pattern.md` — Padrão correto de uso do Supabase em páginas 'use client'
- `timezone-brasil.md` — Como filtrar por data corretamente em UTC-3 (NUNCA subtrair 3h!)

---

## 🐛 Sessão 02/09/2026 — Bugs Críticos Iniciais

### 1. Pedidos não apareciam na aba de Pedidos
- Causa: cliente do navegador sem token válido para RLS
- Correção: API `/api/pedidos/list` usando service_role
- Arquivo: `src/app/api/pedidos/list/route.ts`

### 2. Horário da loja não seguia configuração
- Correção: timezone `America/Sao_Paulo`, retorna `false` quando sem horários
- Arquivo: `src/app/dashboard-view.tsx`

### 3. Lojista sem autonomia para abrir/fechar
- Correção: botão dinâmico Abrir/Fechar, cardápio respeita `config.loja_aberta`

### 4. Cardápio público com cache de 30s
- Correção: `revalidate = 0`

### 5. Busca de complementos não funcionava
- Correção: filtrava só nome da lista, agora busca nos complementos

### 6. Aba de Pedidos reorganizada
- Fluxo: Novo, Preparando, Pronto, Saiu, Entregue
- Histórico: Concluídos, Cancelados

### 7. Layout "Meus Pedidos" Dark Mode com Paleta Dinâmica
- Reescrito `customer-account.tsx` com paleta/tipografia dinâmica

### 8. Fluxo de Caixa Automático (1ª versão)
- API `/api/pedidos/[id]/pago` inseria em `movimentacoes_financeiras`

---

## 🆕 Sessão 04/09/2026 — Ajustes Solicitados pelo Rick

### Commits principais
- `e58a5b7` — ajustes pedidos/avaliacoes/meus pedidos
- `927d3e3` — codigo sequencial + filtros contextualizados + novo visual + trigger fluxo caixa
- `34fe6b1` — pagina avaliacao publica + link WhatsApp + abertura direta pedido
- `6c2b52d` — URLs dinamicas no cardapio publico + fluxo de caixa correto
- `99180c3` — remove debug logs fluxo de caixa
- `fe2e845` — LancarModal via API (bypassa RLS)

---

### A. Sidebar (04/09)
- **Removido** item "Avaliações" do sidebar lateral
- "Avaliações" continua acessível como **subseção dentro de "Marketing"**
- Arquivo: `src/components/sidebar-nav.tsx`

### B. Subseção Avaliações (Marketing > Avaliações)
- **Removidos** cards "Notas pendentes" e "Notas visíveis"
- **Mantidos**: Nota média, Total, Positivas, Negativas
- **Adicionado** botão "Copiar Link" no header (verde, à direita)
  - Copia `${origin}/avaliar-loja/${tenantSlug}`
  - Feedback visual "Link copiado!" por 2s
- Arquivo: `src/app/(dashboard)/avaliacoes/page.tsx`

### C. Aba de Pedidos (lojista) — 04/09
- **Estado inicial**: cai direto na subseção "Novo" + filtro "Hoje"
- **Filtros contextualizados por aba**:
  - **Fluxo**: só "Hoje" e "Ontem"
  - **Histórico**: só "Todos"
- **Filtro "Ontem" corrigido** (componentes locais, sem UTC shift)
- **Filtro de data afeta todas as subseções do Fluxo**
- Arquivo: `src/app/(dashboard)/pedidos/page.tsx`

### D. Meus Pedidos (cardápio público - cliente)
- Função `formatarCodigoPedido(id, createdAt, codigoSalvo)` em `src/lib/utils.ts`
  - Preferência: usa `codigo` salvo no banco (sequencial `XXXXX/AA`)
  - Fallback: hash determinístico do id
- Aplicado em: lista, header, WhatsApp, cards do lojista
- **Cor do título "Acompanhar Pedido"** — forçada branca (`#FFFFFF`)
- **Botão "Falar com o estabelecimento"** — verde WhatsApp (`#25D366`)
- API `/api/pedidos/public` agora retorna campos de endereço
- Arquivos: `src/components/customer-account.tsx`, `src/components/cardapio-cliente.tsx`, `src/lib/utils.ts`

### E. NOVO Visual dos Cards de Pedido
- Aplicado design baseado no `preview.html` do Rick
- Header com código grande (22px) + badge de status colorido
- Avatar do cliente com iniciais + telefone
- Card de endereço com ícone MapPin/Home
- Seção de itens com extras (complementos) indentados
- Bloco de desconto verde
- Footer com forma de pagamento + total + grid de ações 2x3
- Arquivo: `src/app/(dashboard)/pedidos/page.tsx`

### F. Página de Avaliação Pública (NOVO)
- **Nova rota**: `/avaliar-loja/[slug]` (foi renomeada de `/avaliar/[slug]` para evitar conflito com `/avaliar/[token]`)
- Formulário: logo + nome do lojista, 5 estrelas (hover + selecionada), comentário (500 chars), nome + WhatsApp opcionais
- **Nova API**: `/api/avaliar-publico` (POST, com rate limit)
- Avaliações ficam com `aprovado: false` para moderação do lojista
- Arquivos: `src/app/avaliar-loja/page.tsx`, `src/app/avaliar-loja/form.tsx`, `src/app/api/avaliar-publico/route.ts`

### G. Link "Acompanhe seu pedido" no WhatsApp (NOVO)
- Mudou de `${BASE_URL}/pedido/${id}` para `${BASE_URL}/${slug}?pedido=${codigo}`
- Quando cliente clica: vai direto na aba "Meus Pedidos" do cardápio público com o pedido selecionado
- Arquivo: `src/lib/whatsapp/template.ts`, `src/components/checkout-flow.tsx`, `src/app/(dashboard)/pedidos/page.tsx`

### H. URLs Dinâmicas no Cardápio Público (NOVO)
- Cada aba atualiza a URL via `history.pushState`:
  - `/typeacai` — Início
  - `/typeacai?aba=pedidos` — Meus Pedidos
  - `/typeacai?aba=perfil` — Perfil
  - `/typeacai?aba=pedidos&pedido=00021/26` — Detalhe do pedido
- Arquivos: `src/components/cardapio-cliente.tsx`, `src/components/customer-account.tsx`, `src/app/cardapio/[slug]/page.tsx`

### I. Migration 062 — Trigger Automático no Banco (NOVO)
- Cria `trigger trg_pedido_pago_fluxo_caixa` em `public.pedidos`
- Quando `pago=true`: insere automaticamente em `movimentacoes_financeiras` (categoria='pedido')
- Quando `pago=false`: remove a entrada correspondente
- UPSERT via `ON CONFLICT (referencia_id)` para evitar duplicação
- Arquivo: `supabase/migrations/062_trigger_fluxo_caixa_automatico.sql`

### J. Retroativo dos Pedidos Pagos (04/09)
- SQL rodado direto no banco para inserir lançamentos faltantes
- 12 pedidos pagos do Cozinha da Cris + 11 do Type Açaí processados
- Resultado: 100% dos pedidos pagos agora têm lançamento

### K. Fluxo de Caixa — Correções Críticas (04/09)
1. **Bug 1**: API quebrava porque tabela `despesas` não tem coluna `pago` → removida do SELECT
2. **Bug 2**: Promise.all rejeitava tudo se uma query falhava → resolvido com Bug 1
3. **Bug 3**: RLS bloqueava leitura no cliente → API `/api/financeiro` agora usa `service_role` (bypassa RLS, mas valida tenant antes)
4. **Bug 4**: LancarModal tentava INSERT direto pelo cliente (RLS bloqueava) → movido para POST na API
5. **Bug 5**: Deduplicação entre orders pagos e transactions manuais → lógica melhorada (compara com e sem `#`)
- Arquivo: `src/app/api/financeiro/route.ts` (GET, POST, PUT)
- Arquivo: `src/app/(dashboard)/financeiro/page.tsx`

---

## 📊 APIs Criadas/Modificadas

| API | Função |
|-----|--------|
| `/api/pedidos/list` | Lista pedidos (service_role) |
| `/api/pedidos/[id]/pago` | Marca pago + registra entrada |
| `/api/financeiro` (GET) | Lista orders/expenses/transactions (service_role) |
| `/api/financeiro` (POST) | Lançar transação manual |
| `/api/financeiro` (PUT) | Salvar formas de pagamento |
| `/api/avaliar-publico` | Avaliação pública (rate limited) |
| `/api/avaliacoes/public` | Avaliação via token (existente) |

---

## 📁 Migrations Aplicadas

| Migration | Função |
|-----------|--------|
| 053 | Código do pedido formatado (XXXXX/YY) — sequencial por tenant/ano |
| 054 | Status de pagamento por pedido (pago, pago_em, pago_por) |
| 058 | Liberar UPDATE em campos de pagamento |
| 062 | Trigger automático para fluxo de caixa ao marcar pago (atualizado 07/09: trigger simplificada, INSERT fica por conta da API) |

---

## 🛠️ Onde salvar coisas novas (do CLAUDE.md)

- **Progresso do projeto:** `PROGRESSO_WE_DELIVERY.md` (este arquivo)
- **Habilidades aprendidas:** `.claude/skills/<nome>.md`
- **Mudanças em banco:** `supabase/migrations/<numero>_<nome>.sql`
- **Componentes reutilizáveis:** `src/components/`

## ⚠️ Nunca Esquecer

- Build local ANTES de promoção pra produção
- `createClient()` do Supabase sempre DENTRO de handler, nunca no topo
- Validar visualmente em preview antes de subir pra produção
- RLS pode bloquear reads no cliente — usar API com service_role + validar tenant antes
- Trigger do banco garante fluxo de caixa automático (não duplica)

---

## 📋 Comandos Padrão

```powershell
# Validar build local
pnpm run build

# Deploy preview
vercel --yes

# Deploy produção
vercel deploy --prod --yes

# Ver logs do servidor
vercel logs --since 1h
```

---

## Estado funcional atual (04/09)

- ✅ Sidebar sem Avaliações (subseção de Marketing)
- ✅ Cards de avaliação sem Pendentes/Visíveis
- ✅ Botão Copiar Link funcional
- ✅ Filtros de pedidos: Fluxo só Hoje/Ontem, Histórico só Todos
- ✅ Código do pedido XXXXX/YY sequencial
- ✅ NOVO visual dos cards de pedido
- ✅ NOVA página de avaliação pública `/avaliar-loja/[slug]`
- ✅ Link WhatsApp leva ao cardápio com pedido selecionado
- ✅ URLs dinâmicas no cardápio público
- ✅ Trigger automático de fluxo de caixa (banco)
- ✅ Retroativo dos pedidos pagos aplicado
- ✅ Fluxo de caixa aparecendo (lançamento manual + orders pagos)
- ✅ Lançar transação manual funcionando via API

---

## 🆕 Sessão 06/09/2026 — 6 Demandas do Rick

### A. Bug crítico — Loja aberta manualmente bloqueada no checkout (Demanda 5)
- **Sintoma**: Lojista clicava "Abrir loja" fora do horário, dashboard e cardápio mostravam aberta, mas `POST /api/pedidos/public` rejeitava com `Loja fechada — fora do horário (19:00 às 23:00)`
- **Causa**: API validava horário mesmo com override manual `loja_aberta === true`
- **Fix**: Pular validação de horário quando `cfg.loja_aberta === true`
- **Arquivo**: `src/app/api/pedidos/public/route.ts` (linhas 127-138)

### B. Cardápio público — Loja fora do horário (Demanda 1)
- Avisos de "Loja Fechada" estavam com `className="hidden"` nos 3 layouts (Clássico, Moderno, Minimalista)
- Removido `className="hidden"`, padronizado o aviso com ícone 🕐 e texto "Esta loja está fora do horário de funcionamento"
- **Bloqueio no modal de produto**: adicionado overlay bloqueante no `ProdutoModal` (`checkout-flow.tsx` e `cart.tsx`) quando `lojaAberta === false`
  - Modal fica com `pointer-events-none opacity-30` por baixo do overlay
  - Overlay mostra ícone, título "Loja Fechada" e botão "Entendi" com cor do lojista
- Passada prop `lojaAberta` do `CardapioCliente` para o `ProdutoModal`
- **Arquivos**: `src/components/cardapio-cliente.tsx` (linhas 586, 750, 1034 + chamada do `ProdutoModal`), `src/components/checkout-flow.tsx` (interface + overlay), `src/components/cart.tsx` (interface + overlay)

### C. Relatórios — Ticket Médio (Demanda 2)
- Novo card "Ticket Médio" ao lado de Pedidos
- Cálculo: `totalGeral / numeroPedidosPagos` (com proteção contra divisão por zero)
- Grid de cards agora é `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`
- Card mostra valor formatado + label discreto "por pedido pago"
- **Arquivo**: `src/app/(dashboard)/relatorios/page.tsx`

### D. Cardápio público — Busca de bairro (Demanda 3)
- Adicionada barra de pesquisa de bairro em 2 lugares:
  1. **Modal "Seu endereço"** (`cardapio-cliente.tsx`): input com ícone `Search` + `<select>` filtrado (mostra até 6 bairros)
  2. **Dropdown "Selecione o bairro" no checkout** (`checkout-flow.tsx`): input acima da lista, filtra dinamicamente
- Empty state: "Nenhum bairro encontrado para X"
- Limpa busca automaticamente após selecionar
- **Arquivos**: `src/components/cardapio-cliente.tsx`, `src/components/checkout-flow.tsx`

### E. Marketing — Modal "Criar novo cupom" repaginado (Demanda 4)
- Inputs sem classes CSS do design system (estilos inline inconsistentes)
- Aplicadas classes `form-input` em todos os inputs/selects
- Labels com classe `eyebrow` (mesma usada em outros cards do dashboard)
- Espaçamento aumentado: `space-y-3` → `space-y-4`, `gap-3` → `gap-4` nos grids
- Adicionado `max-h-[90vh] overflow-y-auto` para não estourar em telas pequenas
- **Arquivo**: `src/app/(dashboard)/marketing/page.tsx`

### F. Link de Avaliações quebrado (Demanda 6)
- **Sintoma**: `${origin}/avaliar-loja/${tenantSlug}` retornava 404 (página preta)
- **Causa**: rota `/avaliar-loja/[slug]` não existia — só havia `avaliar-loja/page.tsx` (estática, esperava slug nos params mas nunca era roteada)
- **Fix**:
  - Criada rota dinâmica `src/app/avaliar-loja/[slug]/page.tsx` com a lógica antiga
  - Deletada `src/app/avaliar-loja/page.tsx` (estática)
  - **Repaginação visual completa** do `form.tsx` baseada no HTML de referência (`avaliacao-experiencia-cliente.html`):
    - Topbar com botão voltar circular + título "Avaliar experiência"
    - Card branco arredondado (28px radius) com shadow
    - Box do logo do lojista (60×60) com fundo soft tintado pela cor principal
    - 5 estrelas grandes (48px) interativas (hover translateY(-2px), selected = dourado)
    - Mensagem dinâmica da nota (1=Muito ruim → 5=Excelente!)
    - Textarea com contador 0/300
    - Botão submit desabilitado até selecionar nota, com ícone `Send`
    - Estado de sucesso com ícone `Check` + "Obrigado pela avaliação!"
    - **Paleta dinâmica**: `--review-accent` interno usa `tenant.cor_principal` com fallback `#16A34A`
    - Dark mode automático via `@media (prefers-color-scheme: dark)`

---

## Estado funcional atual (06/09)

- ✅ Bug do checkout (override manual) corrigido
- ✅ Aviso de loja fechada visível nos 3 layouts
- ✅ Modal de produto bloqueia seleção quando loja fechada
- ✅ Card "Ticket Médio" em Relatórios
- ✅ Barra de pesquisa de bairro no modal de endereço e checkout
- ✅ Modal de cupom padronizado com design system
- ✅ Link `/avaliar-loja/[slug]` funciona com visual repaginado

## Estado funcional atual (06/09 noite)

- ✅ Mensagem WhatsApp: mostra nome real da loja, itens do pedido, forma pagamento, troco
- ✅ Mensagem WhatsApp: busca itens inline se cache ainda não carregou (evita itens vazios)
- ✅ Botão "Avaliação" pequeno no canto superior direito do card (só status="Entregue")
- ✅ Alert ao copiar link de avaliação mostra nome do cliente
- ✅ Coluna `complemento` inexistente em `clientes` removida dos inserts (já estava corrigido)
- ✅ try/catch em `imprimirPedido` para não crashar em erros inesperados
- ✅ `togglePago` agora converte corretamente `null/undefined` → `false`
- ✅ Botão "Pago" funciona — trigger de fluxo de caixa não tenta mais INSERT via RLS (causava rollback silencioso)
- ✅ Modal de complementos no lançamento manual agora agrupa por categoria com headers visuais
- ✅ Complementos mostram "Grátis" em vez de R$ 0,00
- ✅ Seleção de complementos por categoria com badge de contagem
- ✅ Proteção de estado: ao adicionar novo item limpa complementos do item anterior

---

## Próximas pendências

- Verificar se há outras áreas que dependem do status da loja
- Limpar logs de debug adicionados (console.log em rotas — já removido do financeiro)
- RLS de movimentacoes_financeiras: a policy exige `auth.uid() = usuarios_loja.user_id` — a trigger simplificada (07/09) não tenta mais INSERT via RLS, eliminando o risco de rollback silencioso no "Pago". A inserção em fluxo de caixa é feita pela API com tratamento de erro.

---

## 🆕 Sessão 06/09 (continuação) — Correção do Label da Timeline + Unificação de Clientes

### L. Bug do label "Preparado" na timeline do cliente
- **Sintoma**: No cardápio público (mobile), na tela "Acompanhar pedido", a primeira etapa da timeline aparecia como "preparado" (particípio) enquanto o card de status dizia "sendo preparado" (gerúndio)
- **Causa**: `customer-account.tsx:347` derivava o label curto da timeline via `.replace('Seu pedido está sendo ', '').replace('Pedido ', '')`, o que transformava `'Seu pedido está sendo preparado'` em `'preparado'`
- **Fix**: Criado mapa explícito `STEP_LABEL` com `'Preparando' | 'Pronto' | 'Saiu' | 'Entregue'` (consistente com `STATUS_CONFIG` do lojista em `pedidos/page.tsx`)
- **Arquivo**: `src/components/customer-account.tsx`

### M. Painel CRM de Clientes sem duplicados históricos
- **Sintoma**: Mesmo após a migration 066 marcar duplicados com `[dup-AAAAMMDDHH24MI]`, eles continuavam aparecendo na lista de clientes do lojista
- **Causa**: A query em `clientes/page.tsx:62-66` não filtrava pelo sufixo; a migration 066 só renomeava, sem desativar nem ocultar
- **Fix**:
  - Adicionado `.not('nome', 'ilike', '%[dup-%')` na query principal
  - Adicionada contagem paralela de duplicados ocultos para mostrar um badge amarelo discreto: "⚠️ N clientes duplicados foram ocultados e unificados"
  - Auditoria preservada (registros continuam no banco, apenas não aparecem no CRM)
- **Arquivo**: `src/app/(dashboard)/clientes/page.tsx`

### N. Migration 067 — Unificação retroativa e prevenção de novos duplicados (NOVO)
- **Função RPC**: `public.buscar_ou_unificar_cliente(tenant_id, telefone, novo_token_hash)`
  - Busca todos os clientes com mesmo `(tenant_id, telefone)`
  - Se 0: retorna NULL (caller deve inserir)
  - Se 1: vincula o token novo ao existente (se ainda não tiver)
  - Se 2+: pega o mais antigo (`created_at ASC`) como primário, transfere o token, move pedidos dos duplicados para o primário (`UPDATE pedidos`), e desativa os duplicados (`ativo = false`)
  - Recalcula `total_pedidos` e `ultimo_pedido_em` do primário a partir dos pedidos
  - Usa `FOR UPDATE` para evitar race condition entre pedidos simultâneos do mesmo cliente em dispositivos diferentes
  - Grants: service_role, anon, authenticated
- **Parte 2 da migration**: Roda a função em loop sobre todos os grupos `(tenant_id, telefone)` com duplicados, unificando retroativamente
- **Resultado no banco** (Type Açaí):
  - Rick Machado (47991701079): 5 → 1 ativo + 4 desativados
  - Outros 2 telefones: 2 → 1 + 1 cada
  - Pedidos re-vinculados ao cliente primário
- **Arquivo**: `supabase/migrations/067_unificar_clientes_por_telefone.sql`

### O. `criar_pedido_atomico` agora usa a função de unificação
- **Antes**: buscava/criava cliente apenas por `acesso_token_hash`
- **Agora**: chama `buscar_ou_unificar_cliente(tenant, telefone, token)` antes do INSERT
  - Se retornar ID existente: reaproveita o cliente e atualiza nome/telefone/endereço
  - Se retornar NULL: cria novo registro normalmente
- **Caminho coberto**: cobre clientes que pulam o POST `/api/clientes/public` e vão direto pro checkout (o frontend chama AMBOS hoje)
- **Arquivo**: `supabase/migrations/065_corrigir_criar_pedido_atomico.sql`

### P. `/api/clientes/public` POST chama unificação
- Adicionada chamada a `buscar_ou_unificar_cliente` antes do INSERT
- Complementa a migration 065: garante que mesmo se o cliente usar só o endpoint `/api/clientes/public` (sem ir pro checkout), a unificação acontece
- **Arquivo**: `src/app/api/clientes/public/route.ts`

### Estado funcional pós-correções

- ✅ Timeline do cliente mostra "Preparando" (não "Preparado")
- ✅ Painel CRM do lojista sem duplicados históricos (com aviso de quantos foram ocultados)
- ✅ Cliente do mesmo telefone em 2 dispositivos diferentes → reaproveita o registro primário
- ✅ Pedidos de duplicados re-vinculados ao primário (histórico preservado)
- ✅ Migration retroativa já unificou os 3 grupos do Type Açaí
- ✅ Build local: Compiled successfully (96 páginas)

### Próximos passos (fora deste escopo)

- Criar índice único em `(tenant_id, telefone, ativo)` para garantir integridade futura via constraint do banco
- Migrar identificação do cliente para um sistema mais robusto (ex: magic link via WhatsApp)
- UI no painel do lojista para "mesclar 2 clientes manualmente" (casos excepcionais)


---

## 🚨 Bugs Críticos Resolvidos em 06/09 (mesmo dia)

### Bug A — Cardápio do lojista mostrava 0 produtos
- **Sintoma**: Na aba Cardápio > Produtos, as sessões apareciam vazias mesmo com produtos cadastrados
- **Causa**: Código usava `.is('deleted_at', null)` mas a coluna `produtos.deleted_at` nunca havia sido criada
- **Fix**: Migration `064_soft_delete_produtos.sql` adiciona coluna + índice
- **Validação**: Confirmado via SQL — Type Açaí tem 6 produtos distribuídos em 3 sessões

### Bug B — Erro "Não foi possível concluir o pedido"
- **Sintoma**: Cliente tentava finalizar pedido → erro genérico 409
- **Causa**: Havia 3 overloads da função `criar_pedido_atomico` no banco (6, 7 e 8 parâmetros). PostgREST retornava `PGRST203` por não conseguir escolher entre eles
- **Fix**: Migration `063_consolidar_criar_pedido_atomico.sql` remove as 2 versões antigas, mantendo só a mais recente (com `p_convite_codigo`)

---

## 🚨 Sessão Crítica 06/09 (tarde) — Pedidos Quebrados + Clientes Duplicados

### Bug C — TODOS os pedidos falhando (relation does not exist)
- **Sintoma**: Cliente tentava finalizar pedido → erro 409 "Nao foi possivel concluir o pedido"
- **Causa raiz**: A funcao `criar_pedido_atomico` (deixada em migrations anteriores) referenciava:
  - Tabela `idempotency_keys` que NUNCA foi criada
  - Tabela `convite_codigos` que NUNCA foi criada
  - Coluna `pedidos.idempotency_hash` (correto: `idempotency_key_hash`)
- Toda chamada quebrava com `relation idempotency_keys does not exist`
- **Fix**: Migration `065_corrigir_criar_pedido_atomico.sql` reescreve a funcao com schema real
- **Validacao**: Pedido de teste criado via RPC → codigo 00022/26, R\$ 18, status `novo`

### Bug D — Clientes duplicados (Rick Machado = 5 cadastros!)
- **Sintoma**: `clientes` com 3-5 registros para o mesmo telefone. Rick Machado (47991701079) tinha 5 entradas.
- **Causa**: 
  1. `cardapio-cliente.tsx` salvava `clienteLocal` no localStorage sem o `accessToken`
  2. A cada reload/dispositivo novo, checkout gerava novo token aleatorio
  3. `POST /api/clientes/public` buscava por `acesso_token_hash` → nao encontrava → INSERIA novo registro
  4. Resultado: mesmo cliente fisico com N cadastros (mesmo telefone, tokens diferentes)
- **Fix frontend** (`src/components/cardapio-cliente.tsx`):
  - `onClienteCadastrado` agora persiste o `accessToken` no localStorage imediatamente
  - Recarregar a pagina ou trocar de dispositivo reutiliza o mesmo token
- **Limpeza do banco** (`migration 066_deduplicar_clientes.sql`):
  - Marca duplicatas adicionando sufixo `[dup-AAAAMMDDHH24MI]` no nome
  - Preserva o registro mais antigo como primario
  - Nao deleta (mantem auditoria)
- **Resultado**: 6 duplicatas marcadas na Type Acai (Rick: 4, Zidane: 1, Natanael: 1)

---

## 📊 Resumo Geral da Sessão 06/09/2026

### Demandas originais do Rick (todas entregues):
1. Cardapio publico - loja fora do horario (avisos + bloqueio no modal)
2. Relatorios - Ticket Medio
3. Cardapio publico - barra de pesquisa de bairro
4. Marketing - modal "Criar cupom" repaginado
5. Bug loja aberta manualmente (override na API)
6. Link de avaliacao quebrado (rota dinamica + repaginacao visual)

### Bugs criticos descobertos e corrigidos no mesmo dia:
- A. Cardapio do lojista mostrava 0 produtos (coluna deleted_at faltando)
- B. 3 overloads de criar_pedido_atomico (PGRST203)
- C. Funcao RPC com referencias quebradas (todos pedidos falhavam)
- D. Clientes duplicados (accessToken nao persistido)

### Migrations aplicadas em 06/09:
- 063: Consolida criar_pedido_atomico (remove overloads)
- 064: Adiciona coluna deleted_at em produtos
- 065: Reescreve criar_pedido_atomico com schema real
- 066: Dedup clientes por telefone (marca duplicatas)

### Fix de frontend aplicado:
- `src/components/checkout-flow.tsx`: useEffect redistribui valores de pagamento quando total muda (cupom, taxa)
- `src/components/cardapio-cliente.tsx`: 
  - remove `className="hidden"` dos 3 layouts (avisos visiveis)
  - busca de bairro no modal de endereco
  - persiste accessToken no localStorage apos cadastro

---

## Estado funcional atual (06/09 final)

- 6 demandas do Rick entregues e em producao
- 4 bugs criticos descobertos e corrigidos no mesmo dia
- Build: Compiled successfully (96 paginas)
- Deployment producao: alias wedelivery.site OK
- Pedidos funcionando normalmente
- Sem mais duplicacao de clientes (novos)
- Cardapio do lojista e publico exibindo produtos

---

## 🆕 Sessão 06/09 (rodada extra) — 4 Correções

### Q. Removidos 3 banners gigantes de "Loja Fechada" do cardápio público
- O toggle pequeno no topo (`StoreActions`) já mostra `Fechado | Hoje`, suficiente para informar
- Removidos os blocos `bg-red-50 border-red-300` em:
  - Layout Minimalista (antiga ~linha 631-639)
  - Layout Moderno (antiga ~linha 793-801)
  - Layout Clássico (antiga ~linha 1077-1085)
- **Arquivo**: `src/components/cardapio-cliente.tsx`

### R. Override manual da loja agora respeita o horário programado de expiração
- **Sintoma**: Lojista abria manualmente fora do horário, mas ao recarregar a loja fechava sozinha
- **Causa**: `dashboard-view.tsx` comparava `overrideManual === horarioAtual` — abrir 17h (`horarioAtual=false`) = `true !== false` → override removido
- **Fix**:
  - Novo helper `calcularExpiracaoOverride(horarios, tipo)`:
    - `tipo='abrir'` → retorna Date do próximo horário programado de FECHAMENTO (hoje se ainda não fechou, senão próximo dia ativo)
    - `tipo='fechar'` → retorna Date do próximo horário programado de ABERTURA (hoje se ainda não abriu, senão próximo dia ativo)
  - `abrirLoja`/`fecharLoja` salvam `config.loja_aberta_override_until` como ISO timestamp
  - `loadData` verifica se o override expirou (timestamp <= agora); se não expirou, respeita o override mesmo fora do horário
- **Comportamento conforme Rick**:
  - Abrir manual às 17h (horário 18h-23h) → loja fecha às 23h (horário programado)
  - Fechar manual às 20h → loja reabre no próximo horário programado (ex: 18h do dia seguinte)
- **Arquivo**: `src/app/dashboard-view.tsx`

### S. Cupons: handler de salvar agora é resiliente
- **Sintoma**: Modal abria mas cupom não era salvo, sem feedback
- **Causa**: fetch em `/api/auth/session` silenciosamente falhava, `tenantId` ficava undefined, e o handler retornava sem salvar — sem `alert`
- **Fix**:
  - Trocado o fetch manual por `activeTenantId()` (mesmo padrão usado em outras telas)
  - `try/catch` captura erros do Supabase e mostra `alert()`
  - Validação inicial (`codigo.trim()`, `valor`, `validade`) agora também mostra alert se faltando
- **Arquivo**: `src/app/(dashboard)/marketing/page.tsx`

### T. Defensividade nos botões do card de pedido do lojista
- **Sintoma**: Botões Pago, WhatsApp, Imprimir, Desconto, Editar, Cancelar não respondiam a cliques
- **Causa**: handlers sem `try/catch` — se `gerarMensagemWhatsApp` ou `imprimirPedido` lançasse exceção (ex: `cliente_whatsapp` null), o erro silencioso quebrava a cadeia
- **Fix**:
  - `confirmarPedidoWPP`: try/catch + validação `if (!fone) return alert(...)`
  - `imprimirPedido`: try/catch em torno do handler inteiro
- **Arquivo**: `src/app/(dashboard)/pedidos/page.tsx`

### Estado funcional pós-4 correções (06/09 final do dia)

- ✅ Banner gigante de "Loja Fechada" removido dos 3 layouts
- ✅ Loja aberta manualmente fora do horário permanece aberta até o horário programado
- ✅ Loja fechada manualmente permanece fechada até o próximo horário programado
- ✅ Cupons: criar/editar agora mostra feedback claro e funciona
- ✅ Botões do card de pedido (Pago, WhatsApp, Imprimir, etc) com tratamento de erro
- ✅ Build: Compiled successfully
- ✅ Deploy produção: alias wedelivery.site atualizado

### U. Cupons: constraint única agora ignora cupons inativos
- **Sintoma**: Erro "duplicate key violates unique constraint cupons_tenant_id_codigo_key" ao criar cupom com código que já existia (mesmo "apagado")
- **Causa**: Constraint original `cupons_tenant_id_codigo_key` não distinguia ativo de inativo — cupom marcado `ativo=false` ainda bloqueava novo cupom com mesmo código
- **Fix**: Migration `068_cupons_unique_ativo_only` cria índice parcial:
  ```sql
  CREATE UNIQUE INDEX cupons_tenant_id_codigo_ativo_idx
  ON cupons (tenant_id, lower(codigo))
  WHERE ativo = true;
  ```
- **Arquivo**: `supabase/migrations/068_cupons_unique_ativo_only.sql`
- **Autor**: rick

### V. Modal de cupom com mesma estética do ProdutoFormModal
- Fundo branco (`bg-white`), sombra `shadow-2xl`, cantos `rounded-2xl`
- Labels com `text-sm font-medium text-gray-700 mb-1.5` (mesmo padrão)
- Hints de preenchimento opicional nos campos
- Overlay com `backdropFilter: blur(4px)` e X de fechar no header
- Footer com botões em `border-top` (mesma linha)
- **Arquivo**: `src/app/(dashboard)/marketing/page.tsx`

### U.2 — Cupons: constraint única antiga removida definitivamente
- A migration `068` criou o índice parcial mas **não dropou a constraint antiga** `cupons_tenant_id_codigo_key`
- Resultado: o índice parcial novo (`WHERE ativo=true`) existia MAS a constraint antiga continuava bloqueando tudo
- Fix: `ALTER TABLE cupons DROP CONSTRAINT cupons_tenant_id_codigo_key`
- Agora só o índice parcial vigora — cupons inativos não impedem recriação
- **Autor**: rick (feedback direto)


Evidencias visuais da correcao anterior de preco: `.local-validation/preco-a-partir/` (sete PNGs preservados do worktree de correcao). Resultados sinteticos de sabores: `.local-validation/flavor-ui/` e `.local-validation/flavor-admin/`.
