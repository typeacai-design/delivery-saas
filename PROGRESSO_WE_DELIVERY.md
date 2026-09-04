# We Delivery - Progresso do Sistema

## Última Atualização: 04/09/2026 (final do dia)

## Deploy em Produção
- **URL**: https://wedelivery.site
- **Repositório**: https://github.com/typeacai-design/delivery-saas
- **Último Deploy**: 04/09/2026 — sessão completa de ajustes

---

## 📜 Regra de Habilidades e Skills (do CLAUDE.md)

> **TODA HABILIDADE RELEVANTE DEVE SER SALVA.**

Skills já registradas em `.claude/skills/`:
- `deploy-vercel.md` — Como fazer deploy sem erro
- `supabase-client-pattern.md` — Padrão correto de uso do Supabase em páginas 'use client'

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
| 062 | Trigger automático para fluxo de caixa ao marcar pago |

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

## Próximas pendências

- Verificar se há outras áreas que dependem do status da loja
- Limpar logs de debug adicionados (console.log em rotas — já removido do financeiro)
- Verificar RLS de movimentacoes_financeiras — policy `movimentacoes_tenant_usuarios` exige `auth.uid() = usuarios_loja.user_id` mas o user_id da Type Açaí está com mesmo UUID do tenant_id (anomalia histórica). A solução atual (service_role bypass) contorna isso.
- Possível migration para corrigir o `user_id` correto em usuarios_loja

