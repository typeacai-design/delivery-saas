import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { ehFuncaoEquipe, type FuncaoEquipe } from '@/lib/equipe'

export function adminEquipe() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

export const respostaEquipe = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * Sessão de alguém da equipe com uma das funções permitidas.
 * A equipe nunca acessa o banco direto: as rotas /api/equipe-app usam o service role e devolvem
 * só os campos daquela função.
 */
export async function equipeAutenticada(funcoes: FuncaoEquipe[]) {
  const auth = await authenticatedTenant(funcoes)
  if (!auth.user) return { erro: respostaEquipe({ error: 'Faça login novamente' }, 401) } as const
  if (!auth.tenantId || !ehFuncaoEquipe(auth.role) || !funcoes.includes(auth.role)) return { erro: respostaEquipe({ error: 'Sem acesso' }, 403) } as const
  return { userId: auth.user.id, tenantId: auth.tenantId, funcao: auth.role, admin: adminEquipe() } as const
}
