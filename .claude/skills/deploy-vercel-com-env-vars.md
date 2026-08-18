---
name: deploy-vercel-com-env-vars
description: Como fazer deploy no Vercel + configurar env vars SEM BOM (Byte Order Mark) que corrompe JWT keys. Receita completa testada.
---

# Skill: Deploy Vercel + Env Vars SEM BOM

## ⚠️ REGRA DE OURO

**NUNCA usar `echo | vercel env add`** no Windows PowerShell.
Adiciona **BOM (U+FEFF, char 65279)** que corrompe JWT keys e causa:
`TypeError: Cannot convert argument to a ByteString because the character at index 0 has a value of 65279`

## Workflow

### 1. Validar build local
```powershell
cd "C:\Users\ranie\.claude\PROJETOS\[projeto]"
pnpm run build
```

### 2. Setar env vars SEM BOM (via API direta)
```powershell
node scripts/fix-env-vars.js
```

**Estrutura do script** (`scripts/fix-env-vars.js`):

```js
const https = require('https')

// Buscar token Vercel (caminhos comuns Windows)
function getVercelToken() {
  const paths = [
    `${process.env.APPDATA}\\xdg.data\\com.vercel.cli\\auth.json`,
    `${process.env.APPDATA}\\com.vercel.cli\\Data\\auth.json`,
  ]
  for (const p of paths) {
    try { return require(p).token } catch {}
  }
  return null
}

const PROJECT_ID = 'prj_xxx' // ver .vercel/project.json

function api(method, path, body) {
  const data = body ? JSON.stringify(body) : null
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.vercel.com', port: 443, path, method,
      headers: {
        Authorization: `Bearer ${getVercelToken()}`,
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0
      }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(d) } })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function setEnvVar(key, value, targets = ['production', 'development', 'preview']) {
  const cleanValue = value.replace(/^﻿/, '').trim()

  // Deletar existentes (todas targets)
  const list = await api('GET', `/v9/projects/${PROJECT_ID}/env`)
  if (list.envs) {
    for (const env of list.envs.filter(e => e.key === key)) {
      await api('DELETE', `/v9/projects/${PROJECT_ID}/env/${env.id}`)
    }
  }

  // Criar nova SEM BOM via JSON.stringify
  return api('POST', `/v10/projects/${PROJECT_ID}/env`, {
    key, value: cleanValue, type: 'encrypted', target: targets
  })
}

// Exemplo de uso:
async function main() {
  // Buscar keys externas (Supabase, etc)
  const supabaseKeys = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.supabase.com',
      path: '/v1/projects/REF/api-keys',
      headers: { Authorization: 'Bearer sbp_xxx' }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve(JSON.parse(d)))
    })
    req.end()
  })

  await setEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://xxx.supabase.co')
  await setEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseKeys.find(k => k.name === 'anon').api_key)
  await setEnvVar('SUPABASE_SERVICE_ROLE_KEY', supabaseKeys.find(k => k.name === 'service_role').api_key)
  await setEnvVar('ADMIN_EMAIL', 'email@dominio.com')
  await setEnvVar('ADMIN_PASSWORD', 'senha')

  console.log('✅ Env vars setadas')
}
```

### 3. Deploy
```powershell
vercel --yes --prod
```

## ⚠️ Comandos que QUEBRAM env vars (NUNCA usar)

- ❌ `echo "jwt" | vercel env add` ← BOM
- ❌ `Set-Content` sem `-Encoding utf8NoBOM` ← BOM
- ❌ PowerShell `>` ou `>>` ← BOM
- ❌ `cat` via Git Bash ← pode adicionar BOM

## ✅ Comandos que FUNCIONAM

- ✅ `node scripts/fix-env-vars.js` ← API direta
- ✅ Dashboard web do Vercel (manual)

## Por que funciona via API?
- `JSON.stringify()` codifica strings UTF-8 SEM BOM
- A API REST recebe valor byte-perfect
- `vercel env add` CLI faz outro caminho que adiciona BOM

## Quando der erro 500 "BOM"

1. Verificar que env var não tem BOM: `vercel env pull .check --yes` + checar primeiros bytes
2. Se tiver BOM: rodar `node scripts/fix-env-vars.js` (ele deleta e recria)
3. Fazer redeploy: `vercel --yes --prod`

**Por que:** Gastei 1h+ debugando BOM no delivery-saas. Rick mandou salvar pra não repetir.
**Como aplicar:** Todo deploy de projeto Next.js no Vercel com Supabase (ou qualquer JWT key em env var).