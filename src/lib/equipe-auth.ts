// Função pura (sem dependências de server) — pode rodar em client e server
import { createHmac } from 'node:crypto'

const SECRET = process.env.EQUIPE_PASSWORD_SECRET || process.env.ADMIN_SESSION_SECRET || 'dev-fallback-secret-change-me'

export function hashEquipeSenha(senha: string): string {
  // HMAC-SHA256 com salt fixo derivado do secret
  return createHmac('sha256', SECRET).update(String(senha)).digest('hex')
}

export function verifyEquipeSenha(senha: string, hashArmazenado: string): boolean {
  const hashRecebido = hashEquipeSenha(senha)
  if (hashArmazenado === hashRecebido) return true
  // compatibilidade: aceita plain-text legado
  if (hashArmazenado === senha) return true
  return false
}
