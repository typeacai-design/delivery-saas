# Cardápio Público — Padrão de 3 Layouts

**Última atualização:** 2026-08-09

## Visão geral
O cardápio público (`/cardapio/[slug]`) renderiza em **3 layouts visuais distintos**, escolhidos pelo tenant via `config.layout` no Supabase.

## Arquivos
- **Page server:** `src/app/cardapio/[slug]/page.tsx` — Carrega dados e passa pra componente cliente
- **Componente cliente:** `src/components/cardapio-cliente.tsx` — Contém os 3 layouts em sub-componentes
- **Carrinho:** `src/components/cart.tsx` — `CartDrawer`, `ProdutoModal`

## Os 3 layouts

### 1. CLÁSSICO (default)
- Inspira: Sabor da Casa (app-style laranja)
- Cor primária: laranja (#F97316)
- Id visual: bottom nav, hero genérico, grid 2-col
- Função componente: `LayoutClassico`

### 2. MODERNO
- Inspira: Crispy Chicken (premium vermelho)
- Cor primária: vermelho (#DC2626)
- Id visual: badges (BESTSELLER/POPULAR/SAVE 15%), rating stars, carousel dots
- Função componente: `LayoutModerno`

### 3. MINIMALISTA
- Inspira: Açaí TYPE (web clean)
- Cor primária: verde WhatsApp (#25D366) + laranja (#F97316)
- Id visual: tabs, lista vertical, WhatsApp CTA no header
- Função componente: `LayoutMinimalista`

## Como adicionar/modificar

### Adicionar campo em TODOS os layouts
Cada layout é um componente separado. O que muda em 1, **muda em 3** (estado compartilhado vem via props).

```tsx
// Em LayoutClassico, LayoutModerno, LayoutMinimalista:
// 1. Adicionar prop na assinatura da função
// 2. Renderizar o novo campo
// 3. Não esquecer de passar via CardapioCliente
```

### Trocar inspração visual
1. Editar o layout específico em `cardapio-cliente.tsx`
2. Testar build: `pnpm run build`
3. Deploy: `vercel deploy --prod --yes`

## State compartilhado (props do CardapioCliente)
- `data` — CardapioData (tenant, produtos, categorias, etc)
- `busca` / `setBusca` — termo de pesquisa
- `categoriaAtiva` / `setCategoriaAtiva` — categoria selecionada (só CLÁSSICO)
- `totalItens` — qtd de itens no carrinho
- `produtosFiltrados` — produtos após filtro de busca
- `onAbrirModal(produto)` — abrir modal de seleção
- `onAbrirCarrinho()` — abrir drawer do carrinho

## Tempo de preparo (feature 09/08/2026)
Cada layout tem badge "🕐 X min" exibido em cada produto de forma:
- CLÁSSICO: badge cinza `#F0F0F0`
- MODERNO: badge vermelho claro `bg-red-50`
- MINIMALISTA: badge cinza discreto

No Modal de produto (`cart.tsx`): banner amarelo "⏱️ Pronto em X min"

No Carrinho: banner "⏱️ Pronto em X-Y min" (faixa calculada: 0.9x ~ 1.2x do tempo)

No WhatsApp: texto `⏱️ *Tempo de preparo:* X-Y min`

## Padrão de cálculo de faixa
```tsx
function formatFaixaTempo(min: number): string {
  const minFaixa = Math.max(5, Math.round(min * 0.9))
  const maxFaixa = Math.round(min * 1.2)
  if (minFaixa === maxFaixa) return `${minFaixa} min`
  return `${minFaixa}-${maxFaixa} min`
}
```

## ⚠️ Erros comuns
- Quase esqueci de marcar a task como concluída — usar TaskUpdate sempre
- Renderizar campo em 1 layout e esquecer dos outros 2
- Não rodar build antes de deploy
- Esquecer de adicionar migration no Supabase
- Tratar todo caminho iniciado por `/cardapio` como privado no middleware. Apenas
  `/cardapio` é a tela do lojista; `/cardapio/[slug]` é público.
- Consultas públicas com a chave anon precisam de policies `FOR SELECT TO anon`.
  A página server de `/cardapio/[slug]` usa service role sem expor a chave no
  browser e mantém filtros explícitos de tenant ativo e itens ativos.

## Como testar
1. Login como lojista
2. Cadastrar produto com tempo de preparo
3. Acessar `/cardapio/[slug]` do tenant
4. Verificar badge em cada um dos 3 layouts
5. Adicionar ao carrinho → verificar cálculo
6. Finalizar → ver mensagem WhatsApp

## Relacionados
- Migration: `supabase/migrations/005_tempo_preparo_produto.sql`
- Página de cadastro: `src/app/(dashboard)/cardapio/page.tsx`
- Modal de produto: `src/components/cart.tsx` (função `ProdutoModal`)
