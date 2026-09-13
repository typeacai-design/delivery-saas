import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

const out = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

// Map simples de rate limit por IP usando um cache em memória
// (suficiente para abuso básico; produção usaria Redis)
const rateMap = new Map<string, { count: number; resetAt: number }>()
function rateLimited(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || entry.resetAt < now) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (rateLimited(`avaliar-slug:${ip}`)) {
      return out({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429)
    }

    const body = await req.json()
    const { tenant_slug, nota, comentario, cliente_nome, cliente_whatsapp } = body

    if (!tenant_slug || typeof tenant_slug !== 'string') {
      return out({ error: 'Slug da loja é obrigatório.' }, 400)
    }
    const notaNum = Number(nota)
    if (!Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) {
      return out({ error: 'Nota deve ser um inteiro entre 1 e 5.' }, 400)
    }

    const db = admin()

    // Buscar tenant
    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .select('id, nome')
      .eq('slug', tenant_slug.trim().toLowerCase())
      .eq('status', 'active')
      .maybeSingle()

    if (tenantError || !tenant) {
      return out({ error: 'Loja não encontrada.' }, 404)
    }

    // Sanitizar campos
    const nomeSanitizado = String(cliente_nome || '').trim().slice(0, 100) || null
    const whatsappSanitizado = String(cliente_whatsapp || '').replace(/\D/g, '').slice(0, 20) || null
    const comentarioSanitizado = String(comentario || '').trim().slice(0, 500) || null

    // Inserir avaliação (não aprovada por padrão — moderar antes de exibir)
    const { error: insertError } = await db.from('avaliacoes').insert({
      tenant_id: tenant.id,
      pedido_id: null, // avaliação pública não vinculada a pedido
      cliente_nome: nomeSanitizado,
      cliente_whatsapp: whatsappSanitizado,
      nota: notaNum,
      comentario: comentarioSanitizado,
      aprovado: false,
    })

    if (insertError) {
      console.error('Erro ao inserir avaliação pública:', insertError)
      return out({ error: 'Não foi possível enviar a avaliação.' }, 500)
    }

    return out({ ok: true })
  } catch (err: any) {
    console.error('avaliacao_publica_submit_failed:', err)
    return out({ error: 'Erro interno' }, 500)
  }
}
