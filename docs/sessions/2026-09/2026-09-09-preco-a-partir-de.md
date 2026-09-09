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

## Publication pending explicit approval
Automatic approval review rejected vercel deploy --yes as external publication of private source requiring explicit user authorization. No preview or production deployment occurred. Do not bypass that rejection. Obtain approval for preview to the existing delivery-saas1/delivery-saas Vercel project and production promotion on wedelivery.site after preview validation. Current production is dpl_8ESRAiBYKZAqA7vTEyvF5ozpKcji (delivery-saas-igkexnbcy-delivery-saas1.vercel.app); reconfirm before publishing.

## Boundaries
Pizza flavor averaging is not implemented. Existing order records/catalog prices were not changed. Full authenticated manual-order browser checkout was not exercised against live customers; no real orders were submitted. Broader pre-existing manual pricing/transaction behavior is not redesigned by this patch.
