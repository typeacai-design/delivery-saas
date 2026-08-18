import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cria server client Supabase que funciona cross-domain.
// O segredo: o Supabase client usa o access_token do cookie sb-*-auth-token
// OU do Authorization header. Quando vem via cross-domain, o cookie NÃO é
// setado no domínio principal — mas o client aceita um fallback em memória
// se setarmos a sessão via Authorization header.
//
// Por isso o cookie_options do @supabase/ssr por padrão JÁ sabe fazer
// proxy. O que importa é deixar o createClient simples sem tentar
// gerenciar cookies (que é o que causa bugs cross-domain).

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignora
          }
        },
      },
    }
  )
}