# We Delivery - Progresso do Sistema

## Última Atualização: 24/08/2026

## Deploy em Produção
- **URL**: https://wedelivery.site
- **Repositório**: https://github.com/typeacai-design/delivery-saas
- **Último Commit**: 5542d57 (24/08/2026)

---

## 🐛 Bugs Críticos Resolvidos (Backend)

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
**Última verificação**: 24/08/2026
