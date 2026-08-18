---
name: supabase-client-pattern
description: Padrão correto de uso do Supabase client em páginas Next.js 'use client' sem quebrar build
---

# Skill: Supabase Client Pattern

## ⚠️ Erro Comum

Erro `Your project's URL and API key are required to create a Supabase client!` durante o build.

## Causa

Páginas com `'use client'` que usam Supabase **NÃO PODEM** chamar `createClient()` no topo do componente. O Next.js tenta pré-renderizar durante o build, e as variáveis `NEXT_PUBLIC_*` não estão disponíveis nesse momento.

## ❌ ERRADO

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient() // ← Quebra no build
  // ...
}
```

## ✅ CORRETO

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient() // ← Dentro do handler
    await supabase.auth.signInWithPassword({ email, password })
  }
  // ...
}
```

## Onde foi aplicado

- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/registro/page.tsx`

## Sessão consistente entre login e dashboard

Todas as telas que criam, leem ou encerram a sessão do lojista devem importar
`createClient` de `@/lib/supabase/client`. Não misturar esse factory com
`createBrowserClient` diretamente: clientes com configurações ou `storageKey`
diferentes gravam a sessão em lugares diferentes. Nesse caso o login pode ser
aceito, mas o dashboard não encontra o usuário e redireciona de volta para
`/login`.

**Por que:** Esse padrão evita o erro de build e mantém o Supabase funcionando corretamente em produção.
