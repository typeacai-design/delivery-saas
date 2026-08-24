# We Delivery - Progresso do Sistema

## Última Atualização: 24/08/2026

## Deploy em Produção
- **URL**: https://wedelivery.site
- **Repositório**: https://github.com/typeacai-design/delivery-saas
- **Último Commit**: 044f710 (24/08/2026)

---

## Mudanças Recentes (24/08/2026)

### Sprint Atual

1. **Link do cardápio na raiz** - `/typeacai` ao invés de `/cardapio/typeacai`
2. **Botões em grid 2x3** na página de pedidos (Pago, Desconto, WPP, Editar, Imprimir, Cancelar)
3. **API `/api/pedidos/[id]/pago`** - corrigido erro ao marcar como pago
4. **Reordenar sessões e produtos** - botões subir/descer
5. **Favicon TYPE verde** - novo ícone em todo o sistema
6. **Sincronizar estado pagamentos** - indicador "Salvo/Alterações não salvas"
7. **Cobrança 1%** - nova página `/painel-admin/faturamento`
8. **Correção formas pagamento** - IDs `cartao_credito` e `cartao_debito`

---

## Funcionalidades Implementadas

### 1. Sistema de Pedidos
- [x] Grid 3 colunas de pedidos
- [x] Filtros por status (Novo, Preparando, Pronto, Saiu, Entregue, Cancelado)
- [x] Filtro por data (data atual padrão)
- [x] Tab padrão: "Novo" (novos pedidos primeiro)
- [x] Código do pedido formatado (00001/26)
- [x] Som de novo pedido em loop
- [x] Autocomplete de produtos no modal de edição
- [x] Edição real de pedidos
- [x] Modal de confirmação de cancelamento com motivo

### 2. Botões de Ação
- [x] Botão "Avançar" - full-width, tamanho grande
- [x] Grid 2x3: Pago, Desconto, WPP, Editar, Imprimir, Cancelar
- [x] Cada botão com cor distinta e borda colorida
- [x] Pagamento via API route com auth

### 3. Sistema de Alertas de Tempo
- [x] Componente TempoAlerta no card do pedido
- [x] Verde: No prazo (menos de 80% do tempo)
- [x] Amarelo: Atenção (80% do tempo)
- [x] Vermelho: ATRASADO (100%+ com animação)
- [x] Atualização automática a cada 30 segundos

### 4. Formas de Pagamento
- [x] IDs corrigidos: `cartao_credito`, `cartao_debito`
- [x] Configuração funciona corretamente no cardápio público
- [x] Migration 055 aplicada
- [x] Toggle visual (verde quando ativo)
- [x] Indicador "Salvo/Alterações não salvas"

### 5. Financeiro
- [x] Fluxo de caixa com entradas/saídas
- [x] Saldo atual (positivo/negativo)
- [x] Lançamentos manuais (entrada/saída)
- [x] Código do pedido correto (00001/26)
- [x] Status "Pago" nos pedidos

### 6. Relatórios
- [x] 5 tipos: Período, Forma pagamento, Itens, Complementos, Top dias
- [x] Filtros por período e forma de pagamento
- [x] Entradas vs Saídas vs Saldo

### 7. Cobrança 1%
- [x] Painel admin `/painel-admin/faturamento`
- [x] Calcula 1% do faturamento por lojista
- [x] Filtro por período
- [x] Botão marcar/desmarcar pago
- [x] Cards de resumo

### 8. Cardápio
- [x] URL limpa: `wedelivery.site/[slug]`
- [x] Rota `/[slug]` mostra cardápio
- [x] Botões reordenar sessões e produtos
- [x] Cache invalidado automaticamente

### 9. Painel Admin
- [x] Visão Geral
- [x] Gestão de Lojistas
- [x] Cobrança 1%
- [x] Mensalidades
- [x] Relatórios
- [x] Configurações

---

## Estrutura do Banco de Dados

### Tabelas Principais
- `tenants` - Lojistas
- `usuarios_loja` - Usuários
- `pedidos` - Pedidos (com pago, pago_em, pago_por)
- `produtos` - Produtos (com tempo_preparo_min, ordem)
- `categorias` - Categorias (com ordem)
- `categorias_produtos` - Categorias de tipo
- `despesas` - Despesas fixas
- `movimentacoes_financeiras` - Transações manuais
- `enderecos_entrega` - Bairros e prazos
- `avaliacoes` - Avaliações
- `embaixadores` - Programa de indicação

### Campos Importantes
- `pedidos.pago` - Status de pagamento (boolean)
- `pedidos.pago_em` - Data do pagamento
- `pedidos.pago_por` - Quem marcou como pago
- `pedidos.tempo_estimado_min` - Tempo estimado
- `pedidos.codigo` - Código formatado (00001/26)
- `produtos.tempo_preparo_min` - Tempo de preparo
- `produtos.ordem` - Ordem de exibição
- `categorias.ordem` - Ordem de exibição
- `enderecos_entrega.prazo_min` - Prazo por bairro

---

## Migrations Recentes

| # | Nome | Descrição |
|---|------|-----------|
| 053 | codigo_pedido_formatado | Código 00001/26 |
| 054 | status_pagamento_pedido | Campos pago, pago_em, pago_por |
| 055 | corrigir_formas_pagamento_ids | Migrar credit/debit para cartao_credito/cartao_debito |

---

## URLs Importantes

| Página | URL |
|--------|-----|
| Homepage | https://wedelivery.site |
| Login Lojista | https://wedelivery.site/login |
| Registro | https://wedelivery.site/registro |
| Dashboard | https://wedelivery.site/dashboard |
| Pedidos | https://wedelivery.site/pedidos |
| Financeiro | https://wedelivery.site/financeiro |
| Relatórios | https://wedelivery.site/relatorios |
| Configurações | https://wedelivery.site/configuracoes |
| Cardápio Admin | https://wedelivery.site/cardapio |
| Painel Admin | https://wedelivery.site/painel-admin |
| Faturamento Admin | https://wedelivery.site/painel-admin/faturamento |
| Cardápio Público | https://wedelivery.site/[slug] |

---

## Comandos Úteis

```bash
# Deploy produção
cd C:\Users\ranie\.claude\PROJETOS\delivery-saas
vercel --prod --force

# Verificar banco (Supabase MCP)
# Já disponível via MCP

# Ver logs
vercel logs delivery-saas
```

---

## Notas para Manutenção

1. **Autenticação**: Usa Supabase Auth com RLS
2. **Admin**: Login via `/api/admin/login` com hash de senha
3. **Cardápio público**: Não requer autenticação
4. **Cache**: Cardápio revida a cada 30s
5. **URL limpa**: `/[slug]` ao invés de `/cardapio/[slug]`
6. **Cobrança**: 1% sobre faturamento, gerenciada em `/painel-admin/faturamento`

---

## Próximos Passos

1. ✅ Sistema pronto para receber novos clientes
2. ⏭️ Implementar mais integrações (Z-API, gateway PIX)
3. ⏭️ App PWA para entregadores
4. ⏭️ Programa de embaixadores
5. ⏭️ Sorteios por campanha
