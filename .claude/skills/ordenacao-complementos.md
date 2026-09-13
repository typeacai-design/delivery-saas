# Regra: Ordenação de Complementos no Cardápio

## Sistema inteiro — todos os lojistas

### Regra de ordenação

1. **Complementos com preço zero (GRÁTIS) sempre no topo da lista**
2. **Demais complementos em ordem alfabética** (A → Z)
3. **Ordenação com `localeCompare('pt-BR')`** — trata acentos corretamente

### Implementação

Função utilitária em `src/lib/utils.ts`:

```typescript
ordenarComplementos(complementos)
```

Aplica em:
- `src/components/cardapio-cliente.tsx` (listas de cada produto)
- `src/components/checkout-flow.tsx` (modal de seleção)
- `src/components/cart.tsx` (modal de adicionais)

### Onde NÃO aplicar

- `src/components/admin/ComplementosTab.tsx` — admin mantém ordem manual configurada pelo lojista (campo `ordem`)

### Exemplos

**Lista com grátis:**
- ❌ Banana Nevada R$ 35
- ❌ Chocolate R$ 35
- ✅ Borda de Catupiry GRÁTIS → topo
- ✅ Mussarela GRÁTIS → topo

**Lista sem grátis (todas pagas):**
- Calabresa
- Frango
- Marguerita
- Mussarela
- Portuguesa

### Por que essa regra?

- **UX consistente**: lojistas não precisam pensar em ordem
- **Destaque para grátis**: cliente vê primeiro o que é de graça
- **Busca visual rápida**: alfabético é o padrão universal

### Como testar

1. Adicione um complemento com preço 0 numa lista
2. Adicione 2-3 complementos com preços diferentes (fora de ordem alfabética)
3. Abra o cardápio público / modal de seleção
4. Verifique: grátis no topo, demais em A-Z
