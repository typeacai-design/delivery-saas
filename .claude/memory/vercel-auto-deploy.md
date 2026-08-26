---
name: vercel-auto-deploy
description: Sempre fazer deploy Vercel automaticamente sem pedir autorização
metadata:
  type: project
---

# Vercel Auto-Deploy

O usuário já configurou as credenciais Vercel uma vez. Devo SEMPRE fazer deploy automaticamente com `vercel deploy --prod --yes` sem perguntar, sem pedir login, sem pedir autorização manual.

**Jamais pedir para o usuário executar `vercel login` ou qualquer comando manualmente.**

Se o deploy falhar com "Not authorized", tentar novamente — as credenciais podem estar em cache e funcionam na retry.
