import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy (edge). A autorização por função é feita no servidor:
 * - painel do lojista: src/app/(dashboard)/layout.tsx (só owner/manager);
 * - área da equipe: src/app/acesso/(app)/layout.tsx (Cozinha, Garçom, Motoboy, cada um na sua tela).
 * Aqui só removemos o cookie legado da equipe antiga, que não é mais usado.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  if (request.cookies.has('wd_employee_role')) response.cookies.set('wd_employee_role', '', { path: '/', maxAge: 0 })
  return response
}

export const config = {
  matcher: [
    '/((?!_next|api|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)).*)',
  ],
}
