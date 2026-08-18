---
name: projeto-delivery-saas
description: SaaS multi-tenant Fornalha — delivery para restaurantes
metadata:
  type: project
---

# Fornalha — Delivery SaaS

## Visão Geral
SaaS multi-tenant para delivery de restaurantes/lanchonetes. Nome: **Fornalha — Delivery que funciona**.

## Stack
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS v4
- **Backend**: Supabase (auth, database, storage)
- **Estilo**: Glassmorphism com paleta Verde/Preto/Branco
- **Package Manager**: pnpm

## Estrutura de Pastas
```
src/
├── app/
│   ├── (auth)/           # Login, registro
│   ├── (dashboard)/      # Painel do lojista
│   │   ├── page.tsx          # Visão geral
│   │   ├── pedidos/          # Pedidos
│   │   ├── cardapio/         # Gerenciar cardápio
│   │   ├── gestao/           # Gestão
│   │   ├── marketing/        # Marketing
│   │   ├── relatorios/       # Relatórios
│   │   ├── mensalidade/      # Mensalidade
│   │   └── configuracoes/    # Configurações
│   ├── painel-admin/     # Admin do sistema (Rick)
│   │   ├── login/
│   │   └── (main)/          # Dashboard, lojistas, mensalidades, relatórios, config
│   ├── cardapio/[slug]/ # Cardápio público (client-facing)
│   └── api/admin/       # APIs do admin
├── components/
│   ├── sidebar-nav.tsx      # Nav do painel lojista
│   ├── cardapio-cliente.tsx # Cardápio público
│   └── cart.tsx             # Carrinho
├── lib/
│   ├── supabase/            # Client e server Supabase
│   ├── utils.ts             # Helpers (formatCurrency, cn)
│   └── cidades-brasil.ts    # Lista de cidades
└── types/index.ts           # Types TypeScript
```

## Tabelas Supabase
- `tenants` — lojistas (multi-tenant)
- `categorias` — categorias do cardápio
- `produtos` — produtos
- `variantes` — tamanhos/versões de produtos
- `complementos` — complementos opcionais
- `produto_complementos` — relação produto↔complementos
- `enderecos_entrega` — bairros e taxas
- `pedidos` — pedidos
- `pedidos_itens` — itens do pedido
- `clientes` — clientes do lojista

## Funcionalidades Implementadas
- ✅ Auth (Supabase Auth)
- ✅ Painel admin com dashboard e métricas
- ✅ Painel lojista com visão geral
- ✅ Abrir/fechar loja (toggle)
- ✅ Copiar link do cardápio
- ✅ Cardápio público funcional com carrinho
- ✅ Sistema de complementos e variantes
- ✅ Paletas de cores customizáveis (clássica, quente, escura)

## Estado Atual
MVP funcional em produção. Próximos passos pendentes definidos com Rick.
