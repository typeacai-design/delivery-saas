# Estratégia: Preço de Pizza com 2+ Sabores

## Status: ANOTADO — Implementação futura

## Objetivo
Permitir que o cliente selecione 2 sabores de pizza e pague apenas o valor correspondente (média dos preços).

## Regra de Negócio
**Preço final = média dos preços dos sabores selecionados**
- 1 sabor: paga 100% daquele sabor
- 2 sabores: paga 50% de cada
- 3 sabores: paga 33,33% de cada

## Status Atual
- ✅ Bug de timezone corrigido
- ❌ Regra ainda NÃO implementada no sistema
- ✅ Sistema atual: soma os preços (R$30 + R$40 = R$70) ❌ ERRADO
- ❌ Precisa: média dos preços (R$30 + R$40 = R$35 ÷ 2 = R$35) ✅ CORRETO

## Plano de Implementação Futura

### Fase 1 — Cadastro (PRÓXIMA TAREFA)
Limitar pizzas a 1 sabor por enquanto (sem cálculo de média).

### Fase 2 — Implementar Média (quando cliente solicitar)
1. Marcar pizzas com `qtd_maxima = 2` ou `3` (já feito)
2. Detectar lista "Escolha o Sabor" com `qtd_maxima > 1`
3. Calcular média no frontend (5 locais):
   - `src/components/checkout-flow.tsx:1404` (modal de seleção)
   - `src/components/cart.tsx:51` (carrinho)
   - `src/components/checkout-flow.tsx:228` (subtotal)
   - `src/components/checkout-flow.tsx:474` (envio para API)
   - `src/components/checkout-flow.tsx:753` (exibição)
4. Atualizar função RPC `criar_pedido_atomico` no banco para recalcular/validar
5. Testar todos os cenários:
   - Pizza P/M com 2 sabores
   - Pizza G com 2 ou 3 sabores
   - Remoção/substituição de sabor
   - WhatsApp, impressão, banco de dados

## Quando Implementar
Quando o lojista (Rick) quiser habilitar pizzas com 2+ sabores.
Por enquanto: **limitar a 1 sabor por vez** em pizzas, espaguetes e lasanhas.
