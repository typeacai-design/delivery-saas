# Progresso We Delivery — 2026-08-20

## Sessão de hoje (manhã)

### Bugs Corrigidos

1. **Erro ao finalizar pedido ("não foi possível concluir")**
   - Causa: Trigger `fn_historico_status` tentava acessar `NEW.criado_por` na tabela `pedidos`
   - Campo `criado_por` não existe em `pedidos` (só em `pedido_status_historico`)
   - Solução: Corrigido trigger para usar `NULL` diretamente
   - Migration: `050_corrigir_trigger_historico_status.sql`

2. **QR Code PIX aparecendo na tela de confirmação**
   - Causa: Código tentava processar pagamento PIX via API
   - Solução: Removida toda lógica de processamento PIX
   - Fluxo: Cliente seleciona forma pagamento → vai direto pro WhatsApp do lojista
   - O lojista informa a chave PIX durante a conversa

3. **Pedidos não apareciam instantaneamente no painel do lojista**
   - Causa: Polling simples de 10 segundos
   - Solução: Implementado Supabase Realtime
   - Migration: `051_habilitar_realtime_pedidos.sql` (ALTER PUBLICATION)
   - Agora pedidos aparecem INSTANTANEAMENTE quando cliente finaliza

### Arquivos Modificados
- `src/components/checkout-flow.tsx` — Removido processamento PIX
- `src/app/(dashboard)/pedidos/page.tsx` — Realtime implementado
- `supabase/migrations/050_corrigir_trigger_historico_status.sql`
- `supabase/migrations/051_habilitar_realtime_pedidos.sql`

### Git + Deploy
- **Commits**:
  - `2ec2296` — fix: corrigir trigger fn_historico_status
  - `2a0008d` — fix: remover processamento de pagamento PIX
  - `7a25f98` — feat: Realtime para pedidos
- **GitHub**: https://github.com/typeacai-design/delivery-saas
- **Deploy**: https://wedelivery.site (produção)

---

## 2026-08-20 — Melhoramentos no Painel de Pedidos (Sessão 2 — Tarde)

### 1. Som em loop até confirmar
- Som toca repetidamente até o lojista clicar em "Preparando"
- Removido do loop quando o status muda de "novo"
- Hook `useSomNovoPedido` com controle de loop

### 2. Código do pedido formatado (00001/26)
- Migration 053 aplicada: coluna `codigo` adicionada
- Função `gerar_codigo_pedido()` gera sequência por tenant/ano
- Trigger automático atribui código ao criar pedido
- Formato: 5 dígitos + "/" + 2 últimos dígitos do ano
- Ex: 00001/26, 00002/26... em 2026; 00001/27, 00002/27... em 2027

### 3. Card de pedido com mais informações
- Novo layout em formato de **card quadrado**
- Informações visíveis:
  - Código do pedido (00001/26)
  - Nome do cliente
  - WhatsApp
  - Data/hora
  - Valor total
  - Forma de pagamento
  - Tipo de entrega/endereço
  - Observações
- Detalhes extras em **dropdown colapsável** (Ver mais/menos)

### 4. Estatísticas incluem "Entregues"
- Adicionado status `entregue` na barra de estatísticas
- Agora mostra: Novo, Preparando, Pronto, Saiu, **Entregues**

### 5. Removido filtro de motoboy
- Removido select "Filtrar motoboy:" da barra superior
- Mantido seletor individual por pedido

### 6. Migrations aplicadas
- 053_codigo_pedido_grants
- 053_codigo_funcoes
- 053_ajustar_trigger_codigo
- 053_corrigir_updated_at
- 053_atualizar_codigos_existentes (via função)

---

### Bug: Pedido some do painel do lojista após finalização pelo cliente

**Sintoma:** Cliente finalizava pedido no cardápio digital, valor aparecia no faturamento, mas pedido NÃO aparecia na aba de pedidos.

**4 ERROS IDENTIFICADOS E CORRIGIDOS:**

#### ERRO 1: GRANT SELECT restritivo demais (CRÍTICO)
- **Causa:** Migration 047 concedia apenas 12 colunas para `SELECT` em `pedidos`
- **Impacto:** `cliente_nome`, `forma_pagamento`, `cliente_whatsapp`, `endereco_entrega`, `troco_para` retornavam `null`
- **Correção:** Migration 052 aplicada — GRANT SELECT com todas as 29 colunas necessárias
- **Arquivo:** `supabase/migrations/052_expandir_grants_pedidos_corrigido.sql`

#### ERRO 2: Campos ausentes na resposta da API
- **Causa:** API `/api/pedidos/public` não retornava `cliente_nome` nem `cliente_whatsapp`
- **Impacto:** Lojista não conseguia ver dados do cliente no painel
- **Correção:** Adicionados campos na resposta JSON da API
- **Arquivo:** `src/app/api/pedidos/public/route.ts`

#### ERRO 3: Forma de pagamento como array não manipulado
- **Causa:** Código usava `pedido.forma_pagamento.join(', ')` sem verificar se é array
- **Impacto:** Se `forma_pagamento` fosse `null` ou string, `.join()` falhava
- **Correção:** Adicionado `Array.isArray()` para verificação defensiva
- **Arquivo:** `src/app/(dashboard)/pedidos/page.tsx`

#### ERRO 4: Grant em coluna inexistente
- **Causa:** `pedido_itens` não tem coluna `created_at` — migration falhava silenciosamente
- **Correção:** Removida coluna inexistente do GRANT
- **Arquivo:** `supabase/migrations/052_expandir_grants_pedidos_corrigido.sql`

### Commit
- Migration aplicada diretamente no Supabase via MCP
- Commits de código no repositório

---

### Correções de Segurança ✅
- [x] `criar_pedido_atomico` — REVOGADO do anon
- [x] `search_path` fixo em 6 funções
- [x] RLS policies para `pagamentos`, `api_rate_limits`, `convites_loja`
- [ ] Leaked Password Protection — ⚠️ Pendente (manual no Supabase Dashboard)

### Infraestrutura
- **Git inicializado** no projeto
- **Repo no GitHub**: https://github.com/typeacai-design/delivery-saas
- **Deploy**: GitHub + Vercel CLI (`npx vercel --prod --force`)
- **Banco**: Supabase (iqacuakyyzhrsrjzlnai)

---

## Próxima sessão — Pontos a retomar

### Sprint 5: Motoboys + Avaliações
- [ ] Implementar motoboys próprios da loja
- [ ] Sistema de avaliações com estrelas + comentário

### Sprint 6: Embaixadores + Sorteios
- [ ] Programa de embaixadores
- [ ] Sorteios por campanha

### Integrações
- [ ] Z-API para WhatsApp real
- [ ] Gateway PIX automático (Yampi/Mercado Pago) — **atenção: agora o fluxo é via WhatsApp**
- [ ] App PWA entregadores

### Bugs reportados por lojistas
- [ ] Testar fluxo completo de pedido do cliente ao lojista
- [ ] Verificar se todos os status funcionam corretamente
- [ ] Testar notificação por e-mail/SMS ao lojista (opcional)

### Segurança
- [ ] Leaked Password Protection — Ativar no Supabase Dashboard
