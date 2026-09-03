# We Delivery - Progresso do Sistema

## Última Atualização: 02/09/2026

## Deploy em Produção
- **URL**: https://wedelivery.site
- **Repositório**: https://github.com/typeacai-design/delivery-saas
- **Último Deploy**: Sessão de 02/09/2026 — correções críticas + layout cliente

---

## 🐛 Bugs Críticos Resolvidos — Sessão 02/09/2026

### 1. Pedidos não apareciam na aba de Pedidos (CRÍTICO)
- **Sintoma:** Lojista não conseguia ver nenhum pedido, mesmo fazendo pedidos de teste (som tocava mas lista vazia).
- **Causa raiz:** Query do frontend (`supabase.from('pedidos').select(...)`) usava o cliente do navegador que não tinha o token de autenticação válido para passar pelo RLS do Supabase. O `auth.uid()` retornava null no contexto, fazendo a função `has_active_tenant_role` retornar false.
- **Correção:** Criada rota API `/api/pedidos/list` que usa **service role** no servidor (bypassa RLS) e retorna os pedidos via fetch do frontend.
- **Arquivo:** `src/app/api/pedidos/list/route.ts`
- **Impacto:** Cards somiam após cada ação (desconto, mudar status) — corrigido para também usar `/api/pedidos/list`

### 2. Horário da loja não seguia configuração do lojista
- **Sintoma:** Loja Type Açaí configurada para abrir 19h-23h mostrava "Aberto" às 15h.
- **Causa raiz:** Função `verificarLojaAbertaPorHorario` retornava `true` quando não havia horários configurados (`if (!horarios) return true`). Também faltava timezone de Brasília.
- **Correção:** Função agora retorna `false` quando não há horários; usa `America/Sao_Paulo` timezone; segue a mesma lógica do cardápio público.
- **Arquivo:** `src/app/dashboard-view.tsx`

### 3. Lojista sem autonomia para abrir/fechar loja
- **Sintoma:** Lojista não conseguia forçar abertura/fechamento fora do horário.
- **Causa raiz:** Lógica só mostrava botão "Abrir agora", sem opção de "Fechar". Cardápio público também bloqueava se `!dentroHorario`.
- **Correção:** Lojista agora pode abrir/fechar a qualquer momento. Botão muda entre "Abrir" e "Fechar" baseado no estado. Cardápio público respeita `config.loja_aberta === true` com prioridade sobre horário.
- **Arquivos:** `src/app/dashboard-view.tsx`, `src/app/cardapio/[slug]/page.tsx`

### 4. Cardápio público não refletia mudanças em tempo real
- **Sintoma:** Lojista abria a loja, mas cliente via "Fechado" no cardápio por até 30s.
- **Causa raiz:** `export const revalidate = 30` na página do cardápio cacheava por 30s.
- **Correção:** `revalidate = 0` (sem cache). Mudanças refletem imediatamente.
- **Arquivo:** `src/app/cardapio/[slug]/page.tsx`

### 5. Busca de complementos não funcionava
- **Sintoma:** Lojista digitava nome de complemento e nada aparecia.
- **Causa raiz:** Filtro de busca estava em `listasFiltradas` mas só procurava no nome da lista, não nos complementos dentro dela.
- **Correção:** Lógica agora mostra listas que contêm complementos que correspondem à busca. Adicionada busca por nome no formulário de produtos.
- **Arquivos:** `src/components/admin/ComplementosTab.tsx`, `src/components/admin/ProdutoFormModal.tsx`

### 6. Aba de Pedidos com filtros reorganizados
- **Fluxo:** Novo, Preparando, Pronto, Saiu, Entregue (sem botão "Todos")
- **Histórico:** Concluídos, Cancelados
- **Arquivo:** `src/app/(dashboard)/pedidos/page.tsx`
- **Debug removido:** Linha do `tenantId | Carregados | Filtrados` foi apagada

### 7. Layout "Meus Pedidos" do Cliente — Dark Mode com Paleta Dinâmica
- **Sintoma:** Página de "Meus pedidos" do cliente tinha visual genérico, sem identidade do lojista.
- **Correção:** Reescrito `src/components/customer-account.tsx` com:
  - Lista de pedidos com ícone do status + cor da paleta
  - Ao clicar, mostra layout dark mode completo:
    - Header com cor accent do lojista
    - Card central com ícone + status atual + descrição + tag de previsão
    - Timeline horizontal (Preparando → Pronto → Saiu → Entregue)
    - Card endereço de entrega
    - Card resumo do pedido (expansível)
    - Botão "Falar com o estabelecimento" via WhatsApp
  - **Paleta dinâmica:** usa `cardapio_cores` (primary/secondary/accent) do lojista
  - **Tipografia dinâmica:** usa `cardapio_tipografia` (classica/moderna/minimalista)
  - **Realtime:** atualização instantânea via Supabase channel
- **Erro corrigido:** inicialmente aplicado em `/pedido/[id]/wrapper.tsx` (errado); revertido e aplicado corretamente em `customer-account.tsx`

### 8. Fluxo de Caixa Automático
- **Sintoma:** Marcar pedido como pago não refletia no financeiro/fluxo de caixa.
- **Correção:** API `/api/pedidos/[id]/pago` agora registra automaticamente em `movimentacoes_financeiras` como entrada quando pago=true. Quando desmarcado, remove o registro.
- **Arquivo:** `src/app/api/pedidos/[id]/pago/route.ts`
- **Bug corrigido:** Campo da tabela era `referencia_id`, não `pedido_id`

---

## 📊 APIs Criadas/Modificadas

- `/api/pedidos/list` — Lista pedidos (bypass RLS com service role)
- `/api/pedidos/[id]/pago` — Marca pago + registra entrada no fluxo de caixa
- `/api/diagnostico/session` — Verifica sessão/tenant
- `/api/diagnostico/pedidos` — Verifica pedidos (debug)

---

## Estado funcional atual

- Pedidos aparecem corretamente na aba de Pedidos ✅
- Cards não somem após ações (desconto, mudar status) ✅
- Horário da loja segue configuração ✅
- Lojista pode abrir/fechar loja manualmente a qualquer momento ✅
- Cardápio público reflete status em tempo real ✅
- Busca de complementos funcionando ✅
- Filtros de pedidos organizados por status ✅
- Debug removido da aba Pedidos ✅
- Layout "Meus Pedidos" do cliente com paleta dinâmica ✅
- Realtime entre lojista e cliente ✅
- Fluxo de caixa automático ✅

---

## Próximas pendências

- Remover APIs de diagnóstico (ou manter em modo dev)
- Limpar logs de debug adicionados
- Verificar se há outras áreas que dependem do status da loja


