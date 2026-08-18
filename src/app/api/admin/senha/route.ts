import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { adminUnauthorizedResponse, getAdminSession } from '@/lib/admin-auth'

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET?.trim() || ''

function hash(value: string) {
  return createHash('sha256').update(value + SESSION_SECRET).digest('hex')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

// PUT /api/admin/senha — troca a senha do admin.
// Valida senha atual e atualiza o hash persistido em saas_config.chave='admin'.
// A partir desse ponto, o login compara contra esse hash.
export async function PUT(request: Request) {
  if (!(await getAdminSession())) return adminUnauthorizedResponse()
  if (!SESSION_SECRET) {
    return NextResponse.json({ error: 'Configuração administrativa incompleta' }, { status: 503 })
  }
  const { senhaAtual, novaSenha } = await request.json()
  if (!senhaAtual || !novaSenha) {
    return NextResponse.json({ error: 'Senhas obrigatórias' }, { status: 400 })
  }
  if (novaSenha.length < 8) {
    return NextResponse.json({ error: 'Nova senha deve ter ao menos 8 caracteres' }, { status: 400 })
  }

  // Valida senha atual: primeiro contra a env (legado), depois contra hash persistido.
  const { createClient } = await import('@supabase/supabase-js')
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: cfg } = await supa
    .from('saas_config')
    .select('valor')
    .eq('chave', 'admin')
    .single()
  const storedHash = (cfg?.valor as { senhaHash?: unknown } | null)?.senhaHash
  const envPassword = process.env.ADMIN_PASSWORD?.trim()
  const valid = typeof storedHash === 'string'
    ? safeEqual(storedHash, hash(senhaAtual))
    : Boolean(envPassword && safeEqual(envPassword, senhaAtual))

  if (!valid) {
    return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 })
  }

  // Persiste novo hash
  const merged = { ...(cfg?.valor || {}), senhaHash: hash(novaSenha) }
  const { error } = await supa
    .from('saas_config')
    .upsert({ chave: 'admin', valor: merged, atualizado_em: new Date().toISOString() })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
