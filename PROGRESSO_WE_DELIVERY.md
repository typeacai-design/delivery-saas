# Progresso We Delivery — 2026-08-19

## Sessão de hoje (manhã)

### Git + Deploy
- **Commits**: 
  - `8237272` — feat: gestão de matéria-prima, estoque e refatoração de pedidos
  - `4be8867` — docs: atualizar progresso 2026-08-19
  - `20b4c57` — security: correções de segurança no banco
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
- `supabase/migrations/049_seguranca_correcoes.sql` — Correções de segurança

### Bugs corrigidos no banco
- Função `criar_pedido_atomico` agora verifica estoque corretamente

### Correções de Segurança ✅
- [x] `criar_pedido_atomico` — REVOGADO do anon
- [x] `search_path` fixo em 6 funções
- [x] RLS policies para `pagamentos` (CRUD por tenant)
- [x] RLS policies para `api_rate_limits` (público para rate limit)
- [x] RLS policies para `convites_loja` (público insert, tenant select)

### ⚠️ Pendente (requer ação manual)
- [ ] **Leaked Password Protection** — Ativar no Supabase Dashboard > Auth > Users > Password Security

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
- [x] Corrigir `criar_pedido_atomico` executável por `anon` — ✅
- [x] Adicionar `search_path` fixo nas funções — ✅
- [x] Criar RLS policies para `pagamentos`, `api_rate_limits`, `convites_loja` — ✅
- [ ] Ativar leaked password protection no Auth — ⚠️ MANUAL
