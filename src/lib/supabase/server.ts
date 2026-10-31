import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

/** Request-scoped client: browser cookies or a native Supabase bearer, never both. */
export async function createClient() {
  const cookieStore = await cookies()
  const authorization = (await headers()).get('authorization')
  const native = authorization !== null
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(native ? { global: { headers: { Authorization: authorization! } } } : {}),
      cookies: {
        getAll() { return native ? [] : cookieStore.getAll() },
        setAll(cookiesToSet) {
          if (native) return
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* Read-only Server Component. */ }
        },
      },
    }
  )
}
