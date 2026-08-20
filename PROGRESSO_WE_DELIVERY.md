# Progresso We Delivery — 2026-08-20

## Sessão de hoje (manhã)

### Bugs Corrigidos

1. **Erro ao finalizar pedido ("não foi possível concluir")**
   - Causa: Trigger `fn_historico_status` tentava acessar `NEW.criado_por` na tabela `pedidos`
   - Campo `criado_por` não existe em `pedidos` (só em `pedido_status_historico`)
   - Solução: Corrigido trigger para usar `NULL` diretamente
   - Migration: `050_corrigir_trigger_historico_status.sql`

2. **QR Code PIX aparecendo na tela de confirmação**
   - Causa: Código tentava processar pagamento PIX via API
   - Solução: Removida toda lógica de processamento PIX
   - Fluxo: Cliente seleciona forma pagamento → vai direto pro WhatsApp do lojista
   - O lojista informa a chave PIX durante a conversa

3. **Pedidos não apareciam instantaneamente no painel do lojista**
   - Causa: Polling simples de 10 segundos
   - Solução: Implementado Supabase Realtime
   - Migration: `051_habilitar_realtime_pedidos.sql` (ALTER PUBLICATION)
   - Agora pedidos aparecem INSTANTANEAMENTE quando cliente finaliza

### Arquivos Modificados
- `src/components/checkout-flow.tsx` — Removido processamento PIX
- `src/app/(dashboard)/pedidos/page.tsx` — Realtime implementado
- `supabase/migrations/050_corrigir_trigger_historico_status.sql`
- `supabase/migrations/051_habilitar_realtime_pedidos.sql`

### Git + Deploy
- **Commits**:
  - `2ec2296` — fix: corrigir trigger fn_historico_status
  - `2a0008d` — fix: remover processamento de pagamento PIX
  - `7a25f98` — feat: Realtime para pedidos
- **GitHub**: https://github.com/typeacai-design/delivery-saas
- **Deploy**: https://wedelivery.site (produção)

---

## Histórico — 2026-08-19

### Correções de Segurança ✅
- [x] `criar_pedido_atomico` — REVOGADO do anon
- [x] `search_path` fixo em 6 funções
- [x] RLS policies para `pagamentos`, `api_rate_limits`, `convites_loja`
- [ ] Leaked Password Protection — ⚠️ Pendente (manual no Supabase Dashboard)

### Infraestrutura
- **Git inicializado** no projeto
- **Repo no GitHub**: https://github.com/typeacai-design/delivery-saas
- **Deploy**: GitHub + Vercel CLI (`npx vercel --prod --force`)
- **Banco**: Supabase (iqacuakyyzhrsrjzlnai)

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
- [ ] Gateway PIX automático (Yampi/Mercado Pago) — **atenção: agora o fluxo é via WhatsApp**
- [ ] App PWA entregadores

### Bugs reportados por lojistas
- [ ] Testar fluxo completo de pedido do cliente ao lojista
- [ ] Verificar se todos os status funcionam corretamente
- [ ] Testar notificação por e-mail/SMS ao lojista (opcional)

### Segurança
- [ ] Leaked Password Protection — Ativar no Supabase Dashboard
