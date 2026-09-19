/**
 * Autenticação para membros de equipe (atendentes, cozinha, motoboy)
 * Funcionários logam via /acesso e têm dados no localStorage.
 * A página de atendimento passa esses dados no header X-Membro-Equipe.
 */
import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type FuncionarioPerfil = 'attendant' | 'cozinha' | 'motoboy'

// Usar tipo genérico para evitar problemas de compatibilidade de tipos
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any>

export interface FuncionarioAuth {
  membroId: string
  tenantId: string
  perfil: FuncionarioPerfil
  nome: string
  admin: AdminClient
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Verifica autenticação de funcionário via header X-Membro-Equipe.
 * Retorna null se não for um funcionário autenticado.
 *
 * @param request - Request com header opcional X-Membro-Equipe (base64 do JSON do membro)
 * @param allowedPerfis - Perfis permitidos para esta operação
 */
export async function authenticateFuncionario(
  request: Request,
  allowedPerfis: FuncionarioPerfil[] = ['attendant', 'cozinha', 'motoboy']
): Promise<FuncionarioAuth | null> {
  const headerValue = request.headers.get('X-Membro-Equipe')

  if (!headerValue) {
    return null
  }

  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8')
    const membro = JSON.parse(decoded)

    if (!membro?.id || !membro?.tenant_id || !membro?.perfil) {
      return null
    }

    if (!allowedPerfis.includes(membro.perfil)) {
      return null
    }

    const admin = getAdminClient()

    // Validar que o membro ainda existe e está ativo
    const { data: membroAtual } = await admin
      .from('membros_equipe')
      .select('id, tenant_id, nome, username, perfil, ativo')
      .eq('id', membro.id)
      .eq('ativo', true)
      .maybeSingle()

    if (!membroAtual) {
      return null
    }

    return {
      membroId: membroAtual.id,
      tenantId: membroAtual.tenant_id,
      perfil: membroAtual.perfil,
      nome: membroAtual.nome,
      admin,
    }
  } catch {
    return null
  }
}

/**
 * Wrapper para handlers de API que precisam suportar tanto
 * autenticação de lojista (via cookies) quanto de funcionário (via header).
 */
export async function withDualAuth(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (auth: {
    tipo: 'lojista' | 'funcionario',
    tenantId: string,
    admin?: AdminClient,
    funcionario?: FuncionarioAuth
  }) => Promise<NextResponse>,
  options: {
    allowedFuncionarioPerfis?: FuncionarioPerfil[]
  } = {}
): Promise<NextResponse> {
  const { allowedFuncionarioPerfis = ['attendant', 'cozinha', 'motoboy'] } = options

  // Primeiro, tentar autenticação de funcionário (header)
  const funcionarioAuth = await authenticateFuncionario(request, allowedFuncionarioPerfis)

  if (funcionarioAuth) {
    return handler({
      tipo: 'funcionario',
      tenantId: funcionarioAuth.tenantId,
      admin: funcionarioAuth.admin,
      funcionario: funcionarioAuth,
    })
  }

  // Se não é funcionário, importar e usar autenticação de lojista
  const { authenticatedTenant } = await import('@/lib/tenant-auth')

  // Para lojistas, usar 'owner' como único perfil válido para APIs administrativas
  const auth = await authenticatedTenant(['owner', 'manager'])

  if (!auth.tenantId) {
    const { tenantAuthStatus } = await import('@/lib/tenant-auth')
    const status = tenantAuthStatus(auth)
    return NextResponse.json({ error: 'Sem permissão' }, { status: status || 401 })
  }

  const admin = getAdminClient()

  return handler({
    tipo: 'lojista',
    tenantId: auth.tenantId,
    admin,
  })
}
