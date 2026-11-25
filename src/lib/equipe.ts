/**
 * Equipe da loja (Cozinha, Garçom, Motoboy): identidade por celular + senha.
 *
 * O celular é a identidade da pessoa no WeDelivery (não da loja). Por baixo, cada pessoa
 * é um usuário do Supabase Auth com um e-mail interno derivado do celular, e cada loja
 * só cria um vínculo (usuarios_loja) com uma função.
 */
export type FuncaoEquipe = 'kitchen' | 'attendant' | 'motoboy'

export const FUNCOES_EQUIPE: FuncaoEquipe[] = ['kitchen', 'attendant', 'motoboy']

export const NOME_FUNCAO: Record<FuncaoEquipe, string> = {
  kitchen: 'Cozinha',
  attendant: 'Garçom',
  motoboy: 'Motoboy',
}

export const INICIO_FUNCAO: Record<FuncaoEquipe, string> = {
  kitchen: '/acesso/cozinha',
  attendant: '/acesso/garcom',
  motoboy: '/acesso/motoboy',
}

export const ehFuncaoEquipe = (role: unknown): role is FuncaoEquipe =>
  typeof role === 'string' && (FUNCOES_EQUIPE as string[]).includes(role)

/** Normaliza para o formato 55 + DDD + número (12 ou 13 dígitos). Retorna null se inválido. */
export function normalizarCelular(valor: unknown): string | null {
  let digitos = String(valor ?? '').replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) digitos = '55' + digitos
  if (!/^55[1-9][0-9]9?[0-9]{8}$/.test(digitos)) return null
  return digitos
}

export const emailInternoEquipe = (celular: string) => `${celular}@equipe.wedelivery.internal`

export function formatarCelular(celular: string | null | undefined) {
  const d = String(celular ?? '').replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}

export const SENHA_MINIMA = 6
