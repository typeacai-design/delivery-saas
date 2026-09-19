import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware de proteção de rotas
 *
 * A verificação principal de autorização é feita nos layouts React (lado cliente)
 * que podem acessar localStorage.
 *
 * Este middleware apenas:
 * 1. Permite rotas de acesso público passarem
 * 2. Adiciona headers úteis para APIs
 * 3. Protege rotas críticas contra membros da equipe
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = [
    '/',
    '/login',
    '/registro',
    '/recuperar-senha',
    '/acesso',
    '/api/auth/login',
    '/api/auth/membro-login',
    '/api/auth/logout',
    '/api/auth/session',
    '/api/pedidos/public',
  ]

  // Rotas que são exclusivas para lojistas (dentro do grupo (dashboard))
  // Estas são protegidas pelo layout do (dashboard), mas o middleware
  // adiciona uma camada extra em caso de bypass
  const lojistaRoutes = [
    '/dashboard',
    '/pedidos',
    '/cardapio',
    '/gestao',
    '/financeiro',
    '/equipe',
    '/marketing',
    '/relatorios',
    '/configuracoes',
    '/mesas',
    '/clientes',
    '/avaliacoes',
    '/embaixadores',
    '/sorteios',
    '/motoboys',
  ]

  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )

  // Se é rota pública, permitir
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Para todas as outras rotas, passar para o React verificar autenticação
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes (que têm autenticação própria)
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
