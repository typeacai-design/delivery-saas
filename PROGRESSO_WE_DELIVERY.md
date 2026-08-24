# We Delivery - Progresso do Sistema

## Última Atualização: 24/08/2026

## Deploy em Produção
- **URL**: https://wedelivery.site
- **Repositório**: https://github.com/typeacai-design/delivery-saas
- **Último Commit**: a4c25ba (24/08/2026)

---

## Funcionalidades Implementadas

### 1. Sistema de Pedidos
- [x] Grid 3 colunas de pedidos
- [x] Filtros por status (Novo, Preparando, Pronto, Saiu, Entregue, Cancelado)
- [x] Filtro por data
- [x] Código do pedido formatado (00001/26)
- [x] Som de novo pedido em loop
- [x] Badge de tempo no pedido
- [x] Autocomplete de produtos no modal de edição
- [x] Edição real de pedidos
- [x] Modal de confirmação de cancelamento com motivo
- [x] Cancelamento com confirmação
- [x] Motoboy com comissões

### 2. Botões de Ação (Atualizado em 24/08/2026)
- [x] Botão "Avançar" - full-width, tamanho grande
- [x] Botão "Pago" - verde quando pago, maior e mais visível
- [x] Botão "Desconto" - com ícone
- [x] Botão "WhatsApp" - para confirmar pedido
- [x] Botão "Editar" - com autocomplete de produtos
- [x] Botão "Imprimir" - para cupom
- [x] Botão "Cancelar" - com confirmação

### 3. Sistema de Alertas de Tempo (Atualizado em 24/08/2026)
- [x] Componente TempoAlerta no card do pedido
- [x] Verde: No prazo (menos de 80% do tempo)
- [x] Amarelo: Atenção (80% do tempo)
- [x] Vermelho: ATRASADO (100%+ com animação)
- [x] Atualização automática a cada 30 segundos
- [x] Baseado no campo `tempo_estimado_min` do pedido

### 4. Formas de Pagamento (Corrigido em 24/08/2026)
- [x] Dinheiro
- [x] PIX
- [x] Cartão de Crédito
- [x] Cartão de Débito
- [x] Configuração no painel do lojista
- [x] Aplicação no cardápio público
- [x] Migration 055 para corrigir IDs

### 5. Financeiro
- [x] Aba de Financeiro no dashboard
- [x] Entradas e saídas
- [x] Saldo atual
- [x] Lançamentos manuais
- [x] Transações do tipo entrada/saída
- [x] Toggle para formas de pagamento
- [x] Resumo de entradas/saídas/saldo
- [x] Status "Pago" nos pedidos
- [x] Código do pedido correto

### 6. Relatórios
- [x] 5 tipos de relatório
- [x] Filtros por período
- [x] Faturamento total
- [x] Comissões
- [x] Produtos mais vendidos
- [x] Métodos de pagamento
- [x] Exportação

### 7. Cobrança 1% (Implementado em 24/08/2026)
- [x] Nova página: `/painel-admin/faturamento`
- [x] Calcula 1% do faturamento por lojista
- [x] Filtro por período (data início/fim)
- [x] Botão marcar/desmarcar pago
- [x] Cards de resumo: Total, Comissão, Cobrado, Pendente
- [x] Tabela detalhada por lojista

### 8. Painel Admin
- [x] Visão Geral
- [x] Gestão de Lojistas (aprovar, suspender, reativar)
- [x] Cobrança 1%
- [x] Mensalidades
- [x] Relatórios
- [x] Configurações

---

## Estrutura do Banco de Dados

### Tabelas Principais
- `tenants` - Lojistas
- `usuarios_loja` - Usuários
- `pedidos` - Pedidos
- `produtos` - Produtos
- `categorias` - Categorias
- `despesas` - Despesas fixas
- `movimentacoes_financeiras` - Transações manuais
- `enderecos_entrega` - Bairros e prazos
- `avaliacoes` - Avaliações
- `embaixadores` - Programa de indicação

### Campos Importantes
- `pedidos.pago` - Status de pagamento
- `pedidos.pago_em` - Data do pagamento
- `pedidos.pago_por` - Quem marcou como pago
- `pedidos.tempo_estimado_min` - Tempo estimado
- `pedidos.codigo` - Código formatado
- `produtos.tempo_preparo_min` - Tempo de preparo
- `enderecos_entrega.prazo_min` - Prazo por bairro

---

## Migrations Recentes

| # | Nome | Descrição |
|---|------|-----------|
| 054 | status_pagamento_pedido | Campos pago, pago_em, pago_por |
| 055 | corrigir_formas_pagamento_ids | Corrige credit->cartao_credito |

---

## Para Testar

1. **lojista** → https://wedelivery.site/configuracoes → Pagamentos
   - Desative uma forma de pagamento
   - Acesse o cardápio público
   - Verifique que a forma não aparece

2. **lojista** → https://wedelivery.site/pedidos
   - Verifique botões grandes
   - Observe alerta de tempo

3. **admin** → https://wedelivery.site/painel-admin/faturamento
   - Selecione período
   - Veja faturamento e comissão 1%
   - Marque como pago

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
| Painel Admin | https://wedelivery.site/painel-admin |
| Faturamento Admin | https://wedelivery.site/painel-admin/faturamento |

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
4. **Tempo de cache**: Cardápio revida a cada 30s
5. **Som de pedido**: Arquivo em `/public/sounds/pedido-novo.mp3`
