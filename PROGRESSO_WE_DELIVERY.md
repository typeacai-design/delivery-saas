# Progresso We Delivery — 2026-08-19

## Sessão de hoje

### Git + Deploy
- **Commit**: `8237272` — feat: gestão de matéria-prima, estoque e refatoração de pedidos
- **GitHub**: https://github.com/typeacai-design/delivery-saas
- **Deploy**: https://wedelivery.site (produção)

### Migration aplicada
- `048_estoque_corrigido.sql` — Corrige `criar_pedido_atomico`:
  - Só baixa estoque de insumos se `controlar_estoque = true`
  - Novo parâmetro `p_ignorar_estoque` opcional

### Arquivos commitados
- `public/sounds/pedido-novo.mp3` — Som para novos pedidos
- `src/app/(dashboard)/gestao/page.tsx` — Página de gestão com matéria-prima
- `src/app/(dashboard)/configuracoes/estoque/page.tsx` — Página de estoque
- `src/app/(dashboard)/pedidos/novo/page.tsx` — Refatoração completa (+825/-259 linhas)
- `src/app/(dashboard)/pedidos/page.tsx` — Melhorias na listagem (+91 linhas)
- `src/components/admin/ComplementosTab.tsx` — Clone entre listas (+238 linhas)
- `src/components/admin/ProdutoFormModal.tsx` — Melhorias no formulário (+65 linhas)
- `src/app/api/configuracoes/entregas/route.ts` — Config de entregas
- `src/app/api/pedidos/public/route.ts` — API pública de pedidos
- `src/app/(dashboard)/configuracoes/page.tsx` — Ajustes gerais
- `src/app/(dashboard)/cardapio/page.tsx` — +1 linha
- `src/app/cardapio/[slug]/page.tsx` — +1 linha
- `src/components/cardapio-cliente.tsx` — Ajustes visuais

### Bugs corrigidos no banco
- Função `criar_pedido_atomico` agora verifica estoque corretamente

---

## Histórico — 2026-08-18

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

---

## Próxima sessão — Pontos a retomar

### Sprint 5: Motoboys + Avaliações
- [ ] Implementar motoboys próprios da loja
- [ ] Sistema de avaliações com estrelas + comentário

### Sprint 6: Embaixadores + Sorteios
- [ ] Programa de embaixadores
- [ ] Sorteios por campanha

### Integrações
- [ ] Z-API para WhatsApp real
- [ ] Gateway PIX automático (Yampi/Mercado Pago)
- [ ] App PWA entregadores

### Segurança (BANCO)
- [ ] Corrigir `criar_pedido_atomico` executável por `anon` — CRÍTICO
- [ ] Adicionar `search_path` fixo nas funções
- [ ] Criar RLS policies para `pagamentos`, `api_rate_limits`, `convites_loja`
- [ ] Ativar leaked password protection no Auth
