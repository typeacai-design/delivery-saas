import { createHash, timingSafeEqual } from 'node:crypto'

export const normalizeCpf = (value: unknown) => String(value || '').replace(/\D/g, '').slice(0, 11)
export function isValidCpf(value: unknown) {
  const cpf = normalizeCpf(value)
  if (!cpf) return true
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (size: number) => {
    let sum = 0
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i)
    const result = (sum * 10) % 11
    return result === 10 ? 0 : result
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}
export const hashAccessToken = (token: string) => createHash('sha256').update(token).digest('hex')
export function tokenMatches(token: string, hash: string) {
  const actual = Buffer.from(hashAccessToken(token), 'hex')
  const expected = Buffer.from(hash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
export function bearerToken(request: Request) {
  const value = request.headers.get('authorization') || ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> }
export async function rateLimited(admin: RpcClient, request: Request, scope: string, limit = 30) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const keyHash = createHash('sha256').update(`${scope}:${ip}`).digest('hex')
  const { data, error } = await admin.rpc('consume_api_rate_limit', { p_key_hash: keyHash, p_limit: limit, p_window_seconds: 60 })
  if (error) {
    console.error('rate_limit_rpc_required', error.code || 'unknown')
    return true
  }
  return data !== true
}
