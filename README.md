# We Delivery

## Estado publicado em 2026-08-12

- Migrations `043` a `046` aplicadas em produção.
- Deploy `dpl_3iG8ciu6Kr8KC4871NsLWSuW8z2C` no alias `https://wedelivery.site`.
- Build aprovado com 88 páginas e smoke público HTTP 200.
- Entregues: Design Classic com seis cores HEX e três tipografias; faixas e sessões; checkout, CPF e histórico; módulos operacionais; entrega por bairro/distância; perfil, slug e multi-loja; pedidos/estoque/cupons atômicos; convites seguros e hardening de RLS.

Consulte o [checkpoint técnico da sessão](docs/checkpoints/2026-08-12-sessao-cardapio-operacao.md). Os layouts Moderno e Minimalista, painéis específicos de Cozinha/Motoboy e E2E real permanecem no roadmap. O cálculo por km requer `MAPBOX_ACCESS_TOKEN` e convites de contas existentes podem requerer `RESEND_API_KEY`.

SaaS multi-tenant de cardápio digital, pedidos e gestão para restaurantes.

## Rotas principais

| Contexto | Rota |
| --- | --- |
| Landing pública | `/` |
| Login e cadastro do lojista | `/login` e `/registro` |
| Visão geral do lojista | `/dashboard` |
| Cardápio público | `/cardapio/[slug]` |
| Administração do SaaS | `/painel-admin` |

Credenciais e chaves não devem ser documentadas no repositório. Use variáveis de ambiente locais ou o cofre do provedor.

## Desenvolvimento

```powershell
pnpm install
pnpm run check:setup
pnpm exec tsc --noEmit
pnpm run build
```

O diagnóstico `check:setup` só informa se as variáveis esperadas e os arquivos locais existem; ele nunca imprime valores secretos nem consulta produção.

## Banco e Storage

As migrations ficam em `supabase/migrations`. O código atual referencia os buckets públicos `logos`, `produtos`, `cardapio-assets` e `complementos`. A existência no repositório não comprova que uma migration foi aplicada em um ambiente remoto.

Migrations recentes:

- `037_motoboys_avaliacoes.sql`: motoboys e avaliações;
- `038_complementos_qtd_max.sql`: limite individual de complemento;
- `039_cardapio_leitura_publica.sql`: leitura pública restrita do cardápio;
- `040_sprints_5_6.sql`: avaliação por pedido, embaixadores, sorteios e comissão logística;
- `041_cardapio_assets.sql`: logo/banner e imagens de complementos.

## Estado funcional

- Landing integrada à raiz, com CTAs para cadastro e login;
- Painel do lojista preservado em `/dashboard` e nas rotas operacionais existentes;
- Design do cardápio com layouts, paletas, logo e banner;
- Montagem por listas ordenadas de complementos, carrinho e checkout;
- Entrega/retirada, pagamentos habilitados, resumo e confirmação no WhatsApp;
- Sprint 5: motoboys e avaliações;
- Sprint 6: embaixadores e sorteios.

Antes de liberar um ambiente, valide migrations/buckets nesse ambiente, execute build limpo e faça o roteiro manual descrito em `progresso.md`.

## Pendência funcional documentada

Os únicos acessos operacionais criáveis são `Cozinha` e `Motoboy`. Seus painéis dedicados e a matriz granular de permissões ainda são uma entrega futura; o owner continua sendo um papel interno e não aparece como opção no CRUD.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase e Vercel.
