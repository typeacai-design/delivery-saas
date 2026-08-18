# Progresso We Delivery — 2026-08-18

## Sessão de hoje

### Infraestrutura
- **Git inicializado** no projeto (290 arquivos comitados)
- **Repo no GitHub**: https://github.com/typeacai-design/delivery-saas
- **Deploy**: GitHub + Vercel CLI (`npx vercel --prod --force`)
- Token Vercel persistente em `.env.local`

### Bugs corrigidos

1. **Erro ao criar categoria de produto**
   - Faltava coluna `imagem_url` em `categorias`
   - Migration `051_add_categorias_imagem_url.sql` criada e aplicada
   - Adicionado tratamento de erro + validação de `tenant_id` em `criarCategoria`

2. **Layout do cardápio público**
   - Imagens dos produtos com tamanhos/formatos diferentes (1080x1080 mas com espaços em branco)
   - Adicionado Supabase Transform URL (`?width=600&height=600&resize=cover`) para crop centralizado
   - Forçado `aspect-ratio: 1/1` + `object-fit: cover`
   - `border-radius: 1.5rem` uniforme nos cards

3. **Ordenação de produtos não funcionava**
   - Cardápio público não ordenava por `ordem`
   - Adicionado `.order('ordem', { ascending: true })` em `produtos` e `categorias`

### Melhorias de UI

1. **Botão "+ Novo produto"** fica verde quando há categorias (igual ao "Nova sessão")

2. **Etiquetas (Promoção/Mais vendido/Novidade)** movidas para o canto inferior esquerdo da imagem:
   - Coladas na lateral esquerda (parte esquerda reta)
   - Arredondadas só no lado direito (formato pílula)
   - Sem emojis (só texto)
   - Empilhadas verticalmente

## Arquivos modificados hoje

- `src/app/(dashboard)/cardapio/page.tsx` — botão verde, tratamento de erro
- `src/app/cardapio/[slug]/page.tsx` — ordenação produtos/categorias
- `src/components/cardapio-cliente.tsx` — tags na foto, transform URL
- `src/app/globals.css` — `.wd-product-card` e `.wd-product-image` uniformes
- `supabase/migrations/051_add_categorias_imagem_url.sql` — coluna imagem_url

## Git/Deploy

- Repositório: https://github.com/typeacai-design/delivery-saas
- Cada commit → push → `vercel --prod --force` (workflow manual)
- Builds automáticos ao detectar mudanças no CSS/JSX

## Próxima sessão — Pontos a retomar

- **Sprint 5**: Motoboys + Avaliações
- **Sprint 6**: Embaixadores + Sorteios
- **Validação visual**: lojista deve revisar cardápio mobile após todas as mudanças
- **Integração WhatsApp real** (Z-API) — atual é wa.me manual
- **Gateway PIX automático** (Yampi/Mercado Pago)
- **App PWA entregadores**
