import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { rateLimited } from '@/lib/customer-identity'
import { INICIO_FUNCAO, ehFuncaoEquipe, emailInternoEquipe, normalizarCelular } from '@/lib/equipe'
import { adminEquipe } from '@/lib/equipe-server'

type SessionCookie = { name: string; value: string; options?: Record<string, unknown> }
const erro = (mensagem: string, status: number) => NextResponse.json({ error: mensagem }, { status, headers: { 'Cache-Control': 'no-store' } })

/** Login da equipe (Cozinha, Garçom, Motoboy) com celular e senha. */
export async function POST(request: NextRequest) {
  const admin = adminEquipe()
  if (await rateLimited(admin, request, 'equipe-login', 10)) return erro('Muitas tentativas. Aguarde um minuto.', 429)
  const body = await request.json().catch(() => null) as { celular?: unknown; senha?: unknown } | null
  const celular = normalizarCelular(body?.celular)
  const senha = typeof body?.senha === 'string' ? body.senha : ''
  if (!celular || !senha) return erro('Informe celular e senha', 400)

  const cookies: SessionCookie[] = []
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: lista => lista.forEach(({ name, value, options }) => cookies.push({ name, value, options })),
    },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailInternoEquipe(celular), password: senha })
  if (error || !data.user) return erro('Celular ou senha incorretos', 401)

  const { data: vinculos } = await admin.from('usuarios_loja').select('tenant_id, role, tenants!inner(status)')
    .eq('user_id', data.user.id).eq('ativo', true)
  const vinculo = (vinculos || []).find(v => ehFuncaoEquipe(v.role) && (v.tenants as unknown as { status: string })?.status === 'active')
  if (!vinculo || !ehFuncaoEquipe(vinculo.role)) {
    await supabase.auth.signOut()
    return erro('Este celular não tem acesso ativo em nenhuma loja', 403)
  }

  const resposta = NextResponse.json({ ok: true, destino: INICIO_FUNCAO[vinculo.role] }, { headers: { 'Cache-Control': 'no-store' } })
  for (const c of cookies) resposta.cookies.set(c.name, c.value, c.options as Parameters<typeof resposta.cookies.set>[2])
  resposta.cookies.set('wd_active_tenant', vinculo.tenant_id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  return resposta
}
