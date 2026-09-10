---
name: we-delivery-progresso-2026-09-09-sessao-3
description: "Sessao 3 - 09/09/2026 noite - correcoes de bugs + mesa aberta + equipes + loja manual"
metadata: 
  node_type: memory
  type: project
  originSessionId: 445555ac-a02a-4ae2-861c-f5e9a2f075ee
  modified: 2026-09-09T22:50:00.000Z
---

# We Delivery - Sessão 3 - 09/09/2026 (noite)

## Resumo

Sessão focada em correções críticas de bugs + implementação de equipes (cozinha/motoboy) + sistema robusto de abrir/fechar loja + mesa aberta.

**Branch atual:** `feat/correcoes-pedidos-mesa`

## Migrações Aplicadas

| # | Migration | O que faz |
|---|-----------|-----------|
| 085 | `085_mesa_equipes_tempo_pico.sql` | Tabelas `sessoes_mesa`, `membros_equipe`, `dias_pico` + função `calcular_tempo_preparo` |
| 086 | `086_estado_loja.sql` | Campos `loja_aberta_manual` + `loja_manual_timestamp` em tenants + função `verificar_loja_aberta` |
| 087 | `087_migracao_loja_manual.sql` | Limpa dados legados de override em `config` |

## Correções de Bugs Aplicadas

### Bug 1: Filtro "Hoje" - precisava de duplo clique

**Arquivo:** `src/app/(dashboard)/pedidos/page.tsx`

**Causa:** `new Date().toISOString().split('T')[0]` usava UTC, não horário de Brasília. À noite (UTC-3), a data UTC era do dia seguinte.

**Solução:**
- Data inicial usa `getDataLocal()` (Brasília)
- useEffect sincroniza data local ao montar componente
- Ao entrar na aba Pedidos → já vem com `fluxo` + `novo` + `hoje` ativos

### Bug 2: Atualização automática de pedidos (som tocava mas pedido não aparecia)

**Causa:** Realtime nem sempre disparava re-render

**Solução:**
- Polling backup a cada 30s garante sync
- Key dinâmica no grid força re-render quando filtros mudam
- `loadPedidos` agora é `useCallback` referenciável

### Bug 3: Link de acompanhamento não atualizava (travava em "Pedido Recebido")

**Arquivo:** `src/app/pedido/[id]/wrapper.tsx`

**Causa:** Subscription Realtime sem polling backup + sem log de status

**Solução:**
- Polling backup a cada 5s (consulta `status` direto do banco)
- Realtime com logs de status (`SUBSCRIBED` vs `CLOSED`)
- Channel único por pedidoId (evita colisão)
- Indicador visual: "polling backup ativo" se Realtime falhar

### Bug 4: WhatsApp do lojista ≠ mensagem do cliente

**Arquivo:** `src/app/(dashboard)/pedidos/page.tsx`

**Causa:** Função `confirmarPedidoWPP` usava `normalizarFormaPagamento()` (só nome)

**Solução:**
- Agora busca `formas_pagamento` do banco (nome correto)
- Formata igual ao cliente: `"PIX: R$ 40,00"` ou `"Dinheiro: R$ 38,00"`
- Mensagem idêntica à do cliente, mesma ordem e formatação

### Bug 5: Forma de pagamento não aparecia no card de pedido

**Solução:** Adicionado `formatarFormaPagamentoDisplay()` no card (linha 1608-1611)

### Bug 6: Impressão automática quebrava (abria página offline do Google)

**Causa:** `window.onload` na nova janela não disparava em alguns navegadores

**Solução:**
- `addEventListener('load')` + `setTimeout(300ms)` antes de `window.print()`
- CSS `@media print` com `@page { margin: 10mm }`

### Bug 7: Modal de sucesso do pedido manual com transparência

**Arquivo:** `src/app/(dashboard)/pedidos/novo/page.tsx`

**Causa:** Classes `glass-strong`/`glass-soft` usando variáveis CSS que não resolviam

**Solução:**
- Background branco sólido `#FFFFFF`
- Overlay com 85% opacidade
- Textos com cores explícitas
- Sombra 2xl para destacar

## Novas Funcionalidades

### 1. Mesa Aberta

**Estrutura criada:**
- Tabela `sessoes_mesa` (id, tenant_id, cliente_nome, mesa_numero, valor_total, status)
- Coluna `pedidos.sessao_mesa_id` (vincula pedido à mesa)
- Trigger `atualizar_valor_sessao_mesa()` soma valor_total automaticamente

**Status:** Estrutura criada no banco. Falta integrar na UI de "Lançar Pedido" → tipo "mesa"

### 2. Equipes com perfis diferenciados

**Perfis:**
- `owner` - Acesso total
- `manager` - Gerencia loja
- `attendant` - Atendimento
- `cozinha` - Cozinha (acesso dedicado)
- `motoboy` - Motoboy (acesso dedicado)

**Páginas criadas:**

**`/equipes`** - Painel → Equipe
- Cadastrar com nome, username, senha, perfil
- Ativar/desativar sem excluir
- Editar dados

**`/acesso`** - Login para cozinha/motoboy
- Tela simples com username/senha
- Redireciona conforme perfil

**`/acesso/cozinha`**
- Vê pedidos com status `novo` ou `preparando`
- Botões: "INICIAR PREPARO" e "MARCAR COMO PRONTO"
- Som ao receber novo pedido
- Realtime + atualização automática

**`/acesso/motoboy`**
- Vê pedidos com status `pronto` ou `saiu`
- Mostra: nº pedido, cliente, endereço completo, itens, valor, forma pagamento
- Botões: "Rota" (Google Maps), "WhatsApp", "Saiu", "Entreguei"
- Status de pagamento (Pago/Pendente)

### 3. Sistema Abrir/Fechar Loja Manual

**Regras de negócio:**
- Lojista pode SEMPRE abrir ou fechar manualmente (botão sempre visível)
- Override expira no próximo horário programado:
  - Se abriu manualmente às 17h (programado abre 18h/fecha 23h) → segue aberta até 23h
  - Se fechou manualmente às 22h → abre sozinha às 18h do dia seguinte
- Badge "manual" aparece quando há override ativo
- API: `/api/loja/estado` (GET/POST/DELETE)

**Arquivo principal:** `src/app/dashboard-view.tsx`

### 4. Tempo de Preparo em Dias de Pico

**Estrutura:**
- `tenants.tempo_preparo_extra_minutos` (global)
- Tabela `dias_pico` (agendado por data específica)
- Função `calcular_tempo_preparo(base, tenant_id, data)` retorna tempo correto

**Como ativar:**
- Global: `UPDATE tenants SET tempo_preparo_extra_minutos = 30 WHERE id = 'uuid';`
- Dia específico: `INSERT INTO dias_pico (tenant_id, data, tempo_extra_minutos, motivo) VALUES (...);`

**Status:** Estrutura criada. Falta UI para configurar (configurações da loja)

## Commits da Sessão

```
6c4f505 fix: filtro hoje com data local + sistema robusto de abrir/fechar loja
10b0919 fix: corrige tipos TypeScript para build passar
4a74555 fix: modal de sucesso do pedido manual com background solido
8d76455 feat: correções pedidos + mesa aberta + equipes + tempo pico
```

## Deploys Realizados

1. **Preview:** https://delivery-saas-nf5url78v-delivery-saas1.vercel.app
2. **Produção (1º):** https://delivery-saas-gkxsy9s5v-delivery-saas1.vercel.app
3. **Produção (2º - atual):** https://delivery-saas-l1fke0o8c-delivery-saas1.vercel.app
   - Alias: https://wedelivery.site

## Pendências para Próxima Sessão

### Crítico
- [ ] Testar filtro "Hoje" em produção (deve entrar sem duplo clique)
- [ ] Testar abrir/fechar loja manual (deve funcionar sempre)
- [ ] Testar link de acompanhamento do cliente
- [ ] Testar WhatsApp do lojista (deve ser idêntico ao do cliente)
- [ ] Testar modal de pedido manual (fundo branco)

### Importante
- [ ] Testar cozinha e motoboy (cadastrar membros, fazer login)
- [ ] Testar polling de pedidos (deve atualizar em até 30s)

### Melhorias Futuras
- [ ] Integrar mesa aberta na UI de "Lançar Pedido" (selecionar mesa existente ou criar nova)
- [ ] UI para configurar tempo de preparo em dias de pico (em configurações)
- [ ] Cardápio público deve respeitar `loja_aberta_manual` (mostrar "Loja fechada" quando manual)
- [ ] Push notification para cozinha/motoboy quando há novo pedido

## Áreas que Precisam ser Verificadas para Consistência de Horário

Após mudar sistema de loja aberta/fechada manual, verificar:
- [ ] Cardápio público (`/[slug]`) - deve mostrar "Fechada" quando loja_aberta_manual=false
- [ ] API de pedidos públicos - deve bloquear novos pedidos quando fechada
- [ ] API de carrinho - deve impedir checkout quando fechada
- [ ] Página de acompanhamento do cliente - mostrar status correto
- [ ] Mensagem WhatsApp do cliente - deve ter informação de loja fechada se for horário
- [ ] Dashboard do lojista - status consistente entre visao geral e pedidos
- [ ] Mensagem "Loja fechada" no cardápio público quando manual=false
