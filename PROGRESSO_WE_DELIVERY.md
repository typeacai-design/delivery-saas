# We Delivery - Progresso do Sistema

## Última Atualização: 26/08/2026

## Deploy em Produção
- **URL**: https://wedelivery.site
- **Repositório**: https://github.com/typeacai-design/delivery-saas
- **Último Deploy**: https://delivery-saas-r2t77pcuu-delivery-saas1.vercel.app (26/08/2026 — produção)
- **Commit**: `a26a92a` (fix: correções múltiplas - pedidos, financeiro e clientes)

---

## 🐛 Bugs Críticos Resolvidos — Sessão 26/08/2026

### Correções da Sessão
1. **Filtro de pedidos**: Removido botão "Todos" — agora só Ontem/Hoje/Data específica
2. **Fluxo de caixa**: Só mostra PEDIDOS PAGOS como entrada (antes mostrava todos)
3. **Sessão "Pedidos pendentes"**: Removida completamente do financeiro
4. **Formas de pagamento**: Toggle corrigido — default = todas ON se vazio
5. **Clientes**: Adicionada coluna "Pontos" na tabela (busca de `cliente_pontos`)
6. **Exportação CSV clientes**: Agora inclui coluna de pontos

### Bugs Críticos Resolvidos — Sessão 25/08/2026

### Bug A — Cardápio público mostrava horário fixo `08:00-22:00`
- **Sintoma:** Lojista configurava horários por dia (ex: terça 18:00-23:00), mas cardápio público sempre mostrava `08:00-22:00` ao lado do badge "Aberto/Fechado".
- **Causa raiz:** `src/app/cardapio/[slug]/page.tsx:109` lia `config.horario || {abre:'08:00',fecha:'22:00'}` (campo legado nunca populado). Lojista salva em `config.horarios_dias[chaveDia]` que tinha cálculo correto na linha 144 (`dentroHorario`) mas o valor passado ao client (`data.horario`) vinha do campo legado.
- **Correção:** Calcular `horarioDoDia` a partir de `horariosDia` (já extraído nas linhas 124-131) e popular `data.horariosSemana` (array com os 7 dias) para o modal de horários.
- **Validação:** https://wedelivery.site/cardapio/typeacai agora mostra **18:00-23:00** (banco tem `ter:{abre:'18:00',fecha:'23:00',ativo:true}`).

### Bug B — Query redundante + fallback mascarava formas de pagamento
- **Sintoma:** Mesmo com só `dinheiro:true` no banco, o cardápio público podia mostrar as 4 formas (PIX, cartão crédito/débito) dependendo de timing/cache da segunda query.
- **Causa raiz:** Linha 102-106 fazia `from('tenants').select('config')` redundante (a query principal já trazia `tenant.config`). Se essa segunda query falhasse, `pagamentosSalvos = undefined` → fallback `['dinheiro', 'pix', 'cartao_credito', 'cartao_debito']`.
- **Correção:** Remover query redundante. Usar `config.formas_pagamento_aceitas` direto (já populado pela primeira query).

### Bug C — "Marcar como pago" e "Dar desconto" davam erro
- **Sintoma:** Lojista clicava em "Pago" ou "Desconto" e recebia alert genérico. Pedidos não ficavam marcados como pagos nem recebiam desconto.
- **Causa raiz tripla:**
  1. Trigger `validar_atualizacao_operacional_pedido` (migration 047) só permitia UPDATE em `(status, data_atualizacao, motoboy_id, motoboy_comissao)`. Qualquer UPDATE em `pago, pago_em, pago_por, valor_desconto, valor_total` disparava `RAISE EXCEPTION 'campos de pedido nao autorizados'`.
  2. `valor_desconto` e `valor_total` **não tinham GRANT UPDATE** para `authenticated` (só SELECT e INSERT) — verificado em `information_schema.column_privileges`.
  3. Fetch do `/api/pedidos/[id]/desconto` (linha 801) não enviava `credentials: 'include'`, inconsistente com `/pago` que envia.
- **Correção:** Nova migration `058_trigger_pedido_pagamento_desconto.sql`:
  - Adiciona `pago, pago_em, pago_por, valor_desconto, valor_total` à lista de exceções do trigger
  - Concede `GRANT UPDATE (valor_desconto, valor_total) ON public.pedidos TO authenticated`
- **Frontend:** Adicionado `credentials: 'include'` no fetch do desconto.

### Bug D — Formas de pagamento "voltavam pro desativado" após salvar
- **Sintoma:** Lojista ativava PIX, clicava Salvar, recebia alert de sucesso, mas ao recarregar o toggle PIX aparecia off de novo.
- **Causa raiz:** PUT `/api/financeiro` retornava `{ success: true, config }` onde `config` era o objeto **construído localmente** com spread (teoricamente completo, mas dependia de merge client-side). O cliente fazia `onSaved({...tenant, config: body.config})` — qualquer divergência no merge podia resetar o estado local.
- **Correção:**
  - PUT agora faz `select` pós-update e retorna o tenant canônico lido do banco: `{ success: true, tenant: updatedTenant }`.
  - Cliente usa `onSaved(body.tenant)` direto — sem merge, fonte única de verdade é o banco.
- **Validação SQL:** Testes manuais via `set_config('request.jwt.claims', ...)` mostraram que UPDATE em `pago=true` e `valor_desconto=5.00` agora persistem corretamente.

---

## 🐛 Bugs Críticos Resolvidos (Backend) — Histórico

### Bug 1: Formas de pagamento não seguravam
- **Causa raiz:** API `/api/financeiro` (PUT) exigia role `'owner'` apenas
- **Correção:** Aceitar owner, manager, attendant

### Bug 2: Cardápio mostrava fechado com horário configurado
- **Causa raiz:** Banco armazena `horarios_dias` como objeto `{seg: {...}}` mas código só aceitava array `[{dia: 0}]`
- **Correção:** Suporte para AMBOS formatos no cardápio público

### Bug 3: Pedidos não tinham código formatado em todos os lugares
- **Correção:** Template WhatsApp usa `pedido.codigo` (00001/26) ao invés de UUID

### Bug 4: Página de acompanhamento do cliente não existia
- **Correção:** Nova página `/pedido/[id]` com timeline realtime

### Bug 5: Som de pedido só tocava na aba de pedidos
- **Correção:** Novo componente `GlobalSomPedidos` que vive no layout

### Bug 6: Botoes de ação estavam pequenos e misturados
- **Correção:** Grid 2x3 com botões grandes e coloridos

### Bug 7: Marcar pedido como pago dava erro
- **Correção:** API `/api/pedidos/[id]/pago` + credentials include no fetch

### Bug 8: Botão de desconto usava prompt nativo
- **Correção:** Modal visual com valor/percentual e preview

### Bug 9: Não dava para apagar pedido cancelado
- **Correção:** Soft delete via `deleted_at` + tabela `pedidos_apagados` para auditoria

### Bug 10: Ordenação de categorias/produtos manual
- **Correção:** Botões subir/descer + revalidar cache do cardápio

---

## 🆕 Funcionalidades Implementadas

### Sistema de Pedidos
- Grid 3 colunas com filtros por status e data
- Código do pedido formatado (00001/26) em todos os lugares
- Som de novo pedido em loop GLOBAL (qualquer aba)
- Alertas de tempo (verde/amarelo/vermelho)
- Botão "Pago" + Modal de desconto + Botão "Apagar" (cancelados)
- Acompanhamento do cliente em `/pedido/[codigo]`

### Cardápio Público
- URL limpa: `wedelivery.site/[slug]`
- Suporte correto para horários_dias (array e objeto)
- Status Aberto/Fechado funcionando
- Formas de pagamento respeitando config

### Painel Admin
- Cobrança 1% automática todo dia 05 (Vercel Cron)
- Tempo real do faturamento dos lojistas
- Banner com próxima cobrança e contador regressivo
- Botão "Gerar Comissões" manual

### Removido
- Sistema de mensalidade fixa (R$ 99,90)
- Páginas `/mensalidade` e `/painel-admin/mensalidades`
- API `/api/mensalidades/gerar`
- Link "Mensalidade" do sidebar

---

## 📊 Estrutura do Banco

### Tabelas
- `tenants` - Lojistas
- `pedidos` - Com campos `pago`, `pago_em`, `codigo`, `deleted_at`
- `produtos` - Com `tempo_preparo_min`, `preco_riscado`, `ordem`
- `categorias` - Com `ordem`
- `despesas` - Despesas fixas
- `movimentacoes_financeiras` - Transações manuais
- `enderecos_entrega` - Bairros com `prazo_min`, `taxa`
- `comissoes_mensais` - Histórico de comissões 1%
- `pedidos_apagados` - Auditoria de deletes

### Campos Importantes
- `pedidos.codigo` - Formato 00001/26
- `pedidos.pago` - boolean
- `pedidos.deleted_at` - Soft delete
- `tenants.config.formas_pagamento_aceitas` - IDs: dinheiro, pix, cartao_credito, cartao_debito
- `tenants.config.horarios_dias` - Objeto com chaves seg/ter/qua/qui/sex/sab/dom

---

## 🔄 Migrations Aplicadas

| # | Nome | Descrição |
|---|------|-----------|
| 053 | codigo_pedido_formatado | Código 00001/26 |
| 054 | status_pagamento_pedido | Campos pago/pago_em/pago_por |
| 055 | corrigir_formas_pagamento_ids | Migrar credit/debit para cartao_credito/cartao_debito |
| 056 | comissoes_mensais | Tabela para 1% do faturamento |
| 057 | soft_delete_pedidos | deleted_at + pedidos_apagados |

---

## 🌐 URLs Importantes

| Página | URL |
|--------|-----|
| Cardápio público | `wedelivery.site/[slug]` |
| Login Lojista | `wedelivery.site/login` |
| Painel Lojista | `wedelivery.site/dashboard` |
| Pedidos | `wedelivery.site/pedidos` |
| Acompanhamento cliente | `wedelivery.site/pedido/[codigo]` |
| Financeiro | `wedelivery.site/financeiro` |
| Relatórios | `wedelivery.site/relatorios` |
| Painel Admin | `wedelivery.site/painel-admin` |
| Cobrança 1% | `wedelivery.site/painel-admin/faturamento` |

---

## 📋 Próximos Passos

1. ⏭️ **Preço riscado + tempo de preparo** - Mostrar tempo:
   - COM preço riscado: DEBAIXO do valor
   - SEM preço riscado: AO LADO do valor
2. ⏭️ **Modal de edição de pedido melhorado** - Mais intuitivo
3. ⏭️ **Gateway PIX automático**
4. ⏭️ **App PWA para entregadores**

---

## 🚀 Comandos Úteis

```bash
# Deploy
cd C:\Users\ranie\.claude\PROJETOS\delivery-saas
vercel --prod --force

# Git
git add -A && git commit -m "..." && git push origin main
```

---

**Status**: ✅ Pronto para receber clientes
**Última verificação**: 26/08/2026
