import { NextResponse, type NextRequest } from 'next/server'
import type { TenantRole } from '@/lib/tenant-auth'

/**
 * Proxy de autorização por role.
 *
 * Roda no EDGE antes de qualquer renderização server-side. Não toca em
 * banco — usa apenas o cookie de sessão do Supabase para classificar
 * o usuário em "lojista" ou "operacional".
 *
 * - Lojista (owner/manager) → só acessa rotas /dashboard, /pedidos, /cardapio, etc.
 *   Tentar /acesso/atendimento, /acesso/cozinha, /acesso/motoboy → redirect /dashboard.
 * - Operacional (attendant/kitchen/motoboy) → só acessa /acesso/<perfil>.
 *   Tentar qualquer rota administrativa → redirect /acesso/<perfil>.
 * - Não autenticado → mantém como está (rotas públicas).
 *
 * NOTA: para a classificação server-side definitiva (incluindo o tenant ativo),
 * cada layout server-side faz sua própria verificação com o Supabase server client.
 * O proxy aqui é a PRIMEIRA linha de defesa, antes mesmo do render.
 */

const ADMIN_PREFIXES = [
  '/dashboard',
  '/pedidos',
  '/clientes',
  '/cardapio',
  '/gestao',
  '/financeiro',
  '/equipe',
  '/equipes',
  '/marketing',
  '/relatorios',
  '/configuracoes',
  '/avaliacoes',
  '/embaixadores',
  '/mesas',
  '/motoboys',
  '/sorteios',
  '/suporte',
  '/painel-admin',
]

const EMPLOYEE_ROUTES: Record<TenantRole, string> = {
  attendant: '/acesso/atendimento',
  kitchen: '/acesso/cozinha',
  motoboy: '/acesso/motoboy',
  owner: '/dashboard',
  manager: '/dashboard',
  delivery: '/pedidos',
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

function isEmployeePath(pathname: string): boolean {
  return pathname === '/acesso/atendimento'
    || pathname.startsWith('/acesso/atendimento/')
    || pathname === '/acesso/cozinha'
    || pathname.startsWith('/acesso/cozinha/')
    || pathname === '/acesso/motoboy'
    || pathname.startsWith('/acesso/motoboy/')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1) Lojista tentando área de funcionário → manda pro dashboard.
  if (isEmployeePath(pathname)) {
    // Ignora o login /acesso em si.
    if (pathname === '/acesso') return NextResponse.next()
    // Não temos acesso ao Supabase aqui (edge). Apenas verificamos
    // se a rota /acesso/<perfil> está protegida pelo EmployeeLayout
    // server-side. O proxy deixa passar e o layout faz o guard final.
    return NextResponse.next()
  }

  // 2) Funcionário tentando área administrativa → bloqueia antes do render.
  if (isAdminPath(pathname)) {
    // O guard server-side no DashboardLayout já bloqueia. Aqui apenas
    // adiantamos redirect para rotas óbvias quando o cookie contém
    // a role operacional. A fonte de verdade continua sendo o layout.
    const roleCookie = request.cookies.get('wd_employee_role')?.value as TenantRole | undefined
    if (roleCookie && EMPLOYEE_ROUTES[roleCookie] && roleCookie !== 'owner' && roleCookie !== 'manager') {
      const dest = EMPLOYEE_ROUTES[roleCookie]
      if (dest) {
        const url = request.nextUrl.clone()
        url.pathname = dest
        return NextResponse.redirect(url)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|api|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)).*)',
  ],
}
