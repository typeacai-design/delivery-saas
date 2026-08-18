---
name: deploy-vercel
description: Como fazer deploy do SaaS Fornalha no Vercel sem quebrar (build local → preview → produção)
---

# Skill: Deploy no Vercel

## ⚠️ REGRA DE OURO

**SEMPRE rodar `pnpm run build` local antes de promover pra produção.**

Erros comuns que só aparecem no build:
- Chaves/aspas abertas sem fechamento
- TypeScript types quebrados
- Imports inválidos

## Workflow

```powershell
cd "C:\Users\ranie\.claude\PROJETOS\delivery-saas"

# 1. Validar build local
pnpm run build

# 2. Se passou: deploy preview
vercel --yes

# 3. Após testar preview: promover pra produção
vercel deploy --prod --yes
```

## Comportamento

- O comando `vercel --yes` é interativo por padrão
- Use `--yes` pra aceitar todos os prompts automaticamente
- Rode em **background** se demorar (timeout 300000ms)
- Verifique o output pra confirmar `readyState: "READY"` e `target: "production"`

## Quando o build falha

1. Ler a mensagem de erro com atenção
2. Localizar arquivo/linha no erro
3. Corrigir
4. Rodar build local de novo
5. Só então promover

**Por que:** Rick perde muito tempo com deploy que falha. Validar localmente economiza tokens e tempo.
