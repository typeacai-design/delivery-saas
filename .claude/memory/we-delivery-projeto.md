---
name: we-delivery-projeto
description: Plataforma SaaS de delivery multi-tenant — WeDelivery
metadata:
  type: project
---

# We Delivery — Plataforma SaaS de Delivery

## Visão
Plataforma white-label de delivery multi-tenant. Cada loja tem seu próprio cardápio, pedidos, clientes, relatórios, marketing e equipe.

## Stack
- Next.js 14+ (App Router)
- Supabase (Postgres + Auth + Storage + Realtime)
- Tailwind CSS + componentes próprios (glass, glass-iridescent, btn-primary, etc.)
- Deploy: Vercel (auto-deploy via push no `main`)
- Domínio: https://wedelivery.site

## Perfis (roles)
- `owner` — dono da loja (acesso total)
- `manager` — gerente
- `attendant` — atendente (só `/dashboard`, `/pedidos`, `/clientes`)
- `kitchen` — cozinha
- `motoboy` / `delivery` — entregador

## Estrutura de pastas (resumo)
- `src/app/(dashboard)/` — rotas autenticadas
  - `dashboard/` — visão geral (loja vê tudo; attendant redireciona pra /pedidos)
  - `pedidos/` — pedidos (tabs Fluxo/Histórico/Mesas)
  - `clientes/`, `cardapio/`, `gestao/`, `marketing/`, `relatorios/`, `configuracoes/`
  - `layout.tsx` — layout autenticado, com sidebar (desktop) e bottom-nav (mobile, perfis operacionais)
- `src/app/api/auth/` — APIs de auth (login, session, etc.)
- `supabase/migrations/` — migrations numeradas (último visto: 092)

## Áreas críticas
- **Atendimento (attendant)**: usuário pediu pra não mexer sem avisar — layout é estável
- **Checkout público** (`src/app/(loja)/cardapio/`): experiência do cliente final
- **Configurações → Mesas**: toggle global + CRUD de mesas (minha `MesasTab`, sobreviveu ao merge em set/2026)

## Como testar (sessão 2026-09-12)
- URL: https://wedelivery.site/login
- Login de atendente → cai em /pedidos
- Tab Mesas em /pedidos
- Configurações → Mesas (toggle + cadastro)
- Pedidos → Novo → tipo "Mesa" → seletor aparece
