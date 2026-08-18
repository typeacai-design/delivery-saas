# Delivery SaaS — Fornalha

## 📜 Regra de Habilidades e Skills

> **TODA HABILIDADE RELEVANTE DEVE SER SALVA.**

Sempre que eu aprender/realizar algo novo neste projeto, devo:

1. **Identificar se é uma habilidade reutilizável** (ex: deploy, padrão Supabase, ajuste de design system)
2. **Salvar como skill** em `.claude/skills/` na pasta do projeto
3. **Antes de executar qualquer tarefa**, verificar se já existe skill registrada
4. **Se existir, usar a skill** em vez de improvisar

### Skills já registradas

- `.claude/skills/deploy-vercel.md` — Como fazer deploy sem erro
- `.claude/skills/supabase-client-pattern.md` — Padrão correto de uso do Supabase em páginas 'use client'

## 🔧 Comandos Padrão

```powershell
# Validar build local
pnpm run build

# Deploy preview
vercel --yes

# Deploy produção
vercel deploy --prod --yes
```

## 📁 Onde salvar coisas novas

- **Progresso do projeto:** `README.md` (atualizar a cada conquista grande)
- **Habilidades aprendidas:** `.claude/skills/<nome>.md`
- **Mudanças em banco:** `supabase/migrations/<numero>_<nome>.sql`
- **Componentes reutilizáveis:** `src/components/`

## ⚠️ Nunca Esquecer

- Build local ANTES de promoção pra produção
- `createClient()` do Supabase sempre DENTRO de handler, nunca no topo
- Validar visualmente em preview antes de subir pra produção
