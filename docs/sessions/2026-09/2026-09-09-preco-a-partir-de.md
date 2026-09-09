> Atualizacao posterior de 09/09/2026: a divisao em sabores tambem foi implementada e publicada. As limitacoes descritas neste registro representam o estado na data da correcao de preco. Consulte [o progresso atual](../../../PROGRESSO_WE_DELIVERY.md) e [a liberacao de sabores](../../releases/2026-09-09-divisao-sabores.md).

# Reference-price correction - 2026-09-09

The explicit produtos.exibir_preco_a_partir_de flag now makes the product price display-only: selected complements determine the charge. Fixed-price products keep their base charge. Automatic variant-based catalog labels do not change that rule.

## Baseline and location
- Active production baseline: 4aaafe68b9045f1ab036c3f9629a7defcf521963, found in C:/Users/ranie/delivery-saas (8 commits ahead of origin/main at inspection).
- The original .claude/PROJETOS/delivery-saas working directory is older and has unrelated uncommitted changes. It was preserved.
- Fix branch: fix/preco-a-partir-de in C:/Users/ranie/we-delivery-preco-fix. Rebased onto the exact production baseline.

## Changes
- Shared chargedProductBase rule for public/manual selection, public authoritative API, and product changes in order editing.
- Restored open carts normalize catalog base prices, including old localStorage carts. Saved orders are never normalized against current catalog.
- Authenticated creation endpoints remove stale reference charges from submitted items/totals, retaining their existing fee/discount conventions.
- Order edit route now checks authenticated shop/role and scopes its privileged queries to that shop.
- Receipt, tracking and item detail displays include stored complements even when base is zero; WhatsApp unit summary includes extras.
- Product setting help text explains its charging effect. No database migration or catalog write.

## Validation
- 20 automated tests passed, including execution of the real public POST handler with an in-memory database: fixed/reference products, quantities 1/2, browser price tampering, stored-price display, stale cart normalization.
- Production build passed, 96 pages, TypeScript passed. Existing Cache-Control warning remains.
- Read-only catalog query confirmed Cris products use the explicit flag.
- Local browser used the existing catalog with all non-GET/HEAD requests blocked. Espaguete Pequeno + Espaguete de Frango displays R$27.00, not R$54.00; stale local cart base is removed on reload. Screenshots in artifacts/preco-a-partir/.
- Local build/runtime must load environment from C:/Users/ranie/.claude/PROJETOS/delivery-saas/.env.local into process memory. The active source checkout and linked worktree .env.local contain only a Vercel OIDC token. Never print or commit environment values.

## Publication completed - 2026-09-09
The user explicitly authorized deployment to Vercel/production and any necessary Supabase work. The earlier approval rejection was resolved by that authorization.

- Published code commit: f16b5ba (on production baseline 4aaafe6).
- Preview build: dpl_2XvVVioVp5dESaSB6ztyvzXq1HRP, READY. Preview environment lacks the service-role key, so runtime validation used a staged production build instead of changing shared environment permissions.
- Staged production: dpl_7NehPjynkyVYmZKKN5NCiSvTXESi, https://delivery-saas-6ywo5gv2e-delivery-saas1.vercel.app, built with --prod --skip-domain and verified using the existing Vercel deployment access credential.
- Promoted that exact build with vercel promote. The wedelivery.site alias was confirmed to point to dpl_7NehPjynkyVYmZKKN5NCiSvTXESi.
- Vercel build and TypeScript passed, 96 pages.
- Public HTTP checks passed for /, /login, /cozinhadacris and /typeacai.
- Browser checks on staged production and wedelivery.site confirmed Espaguete Pequeno + Espaguete de Frango = R$27.00. Public-domain verification passed at 390px and 1280px widths. Browser writes were blocked; no real orders were submitted.
- Screenshots: artifacts/preco-a-partir/vercel-staged-mobile.png and producao-390.png / producao-1280.png in the isolated worktree.
- No database migration, catalog edit or existing order update was required.
- Previous production available for rollback: dpl_8ESRAiBYKZAqA7vTEyvF5ozpKcji.

## Boundaries
Pizza flavor averaging is not implemented. Existing order records/catalog prices were not changed. Full authenticated manual-order browser checkout was not exercised against live customers; no real orders were submitted. Broader pre-existing manual pricing/transaction behavior is not redesigned by this patch.
