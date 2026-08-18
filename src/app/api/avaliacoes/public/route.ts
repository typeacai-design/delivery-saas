import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashAccessToken, rateLimited } from '@/lib/customer-identity'

function admin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }) }
const out = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest) {
  try {
    const db = admin()
    if (await rateLimited(db, req, 'review-submit', 8)) return out({ error: 'Limite excedido' }, 429)
    const { token, nota, comentario } = await req.json()
    const notaNum = Number(nota)
    if (!token || String(token).length < 24 || !Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) return out({ error: 'Dados inválidos' }, 400)
    const tokenHash = hashAccessToken(String(token))
    const { data: pedido } = await db.from('pedidos').select('id,tenant_id,cliente_nome,cliente_whatsapp,status,avaliacao_token_expires_at,avaliacao_token_used_at').eq('avaliacao_token_hash', tokenHash).maybeSingle()
    if (!pedido) return out({ error: 'Convite inválido' }, 404)
    if (!pedido.avaliacao_token_expires_at || new Date(pedido.avaliacao_token_expires_at) <= new Date()) return out({ error: 'Convite expirado' }, 410)
    if (pedido.status !== 'entregue') return out({ error: 'A avaliação será liberada depois da entrega' }, 409)
    const { data: existente } = await db.from('avaliacoes').select('id').eq('pedido_id', pedido.id).maybeSingle()
    if (existente || pedido.avaliacao_token_used_at) return out({ error: 'Pedido já avaliado' }, 409)
    const { error } = await db.from('avaliacoes').insert({ tenant_id: pedido.tenant_id, pedido_id: pedido.id, cliente_nome: pedido.cliente_nome, cliente_whatsapp: pedido.cliente_whatsapp, nota: notaNum, comentario: String(comentario || '').trim().slice(0, 1000) || null, aprovado: false })
    if (error) throw error
    const { error: consumeError } = await db.from('pedidos').update({ avaliacao_token_used_at: new Date().toISOString() }).eq('id', pedido.id).eq('avaliacao_token_hash', tokenHash).is('avaliacao_token_used_at', null)
    if (consumeError) throw consumeError
    return out({ ok: true })
  } catch { console.error('review_submit_failed'); return out({ error: 'Não foi possível enviar a avaliação' }, 500) }
}

export async function PUT(req: NextRequest) {
  try {
    const db = admin()
    if (await rateLimited(db, req, 'review-invite-read', 20)) return out({ error: 'Limite excedido' }, 429)
    const { token } = await req.json()
    if (!token || String(token).length < 24) return out({ error: 'Token obrigatório' }, 400)
    const tokenHash = hashAccessToken(String(token))
    const { data: pedido } = await db.from('pedidos').select('id,status,cliente_nome,avaliacao_token_expires_at,avaliacao_token_used_at,tenants(nome,slug)').eq('avaliacao_token_hash', tokenHash).maybeSingle()
    if (!pedido) return out({ error: 'Convite inválido' }, 404)
    if (!pedido.avaliacao_token_expires_at || new Date(pedido.avaliacao_token_expires_at) <= new Date()) return out({ error: 'Convite expirado' }, 410)
    const { data: existente } = await db.from('avaliacoes').select('id').eq('pedido_id', pedido.id).maybeSingle()
    return out({ pedido: { status: pedido.status, cliente_nome: pedido.cliente_nome, loja: pedido.tenants }, ja_avaliado: !!existente || !!pedido.avaliacao_token_used_at })
  } catch { return out({ error: 'Não foi possível consultar o convite' }, 500) }
}

export async function GET(req: NextRequest) {
  try {
    const db = admin()
    const slug = new URL(req.url).searchParams.get('slug')?.trim().toLowerCase()
    if (!slug) return out({ error: 'Slug obrigatório' }, 400)
    if (await rateLimited(db, req, `reviews-public-${slug}`, 60)) return out({ error: 'Limite excedido' }, 429)
    const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).eq('status', 'active').maybeSingle()
    if (!tenant) return out({ avaliacoes: [], media: 0, total: 0 })
    const [{ data: recentes, error: reviewsError }, { data: stats, error: statsError }] = await Promise.all([
      db.from('avaliacoes').select('nota,comentario,resposta_admin,created_at').eq('tenant_id', tenant.id).eq('aprovado', true).order('created_at', { ascending: false }).limit(20),
      db.rpc('get_public_review_stats', { p_tenant_id: tenant.id }),
    ])
    if (reviewsError || statsError) throw reviewsError || statsError
    const stat = Array.isArray(stats) ? stats[0] : stats
    const total = Number(stat?.total || 0)
    const media = Number(stat?.media || 0)
    return out({ avaliacoes: (recentes || []).map(review => ({ ...review, cliente_nome: 'Cliente' })), total, media })
  } catch { return out({ error: 'Não foi possível consultar as avaliações' }, 500) }
}