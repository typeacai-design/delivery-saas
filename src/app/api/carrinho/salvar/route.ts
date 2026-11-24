import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimited } from '@/lib/customer-identity'
import { formatarNomeProprio } from '@/lib/nome-proprio'

function adminClient() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }) }
const respond = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const SESSION = /^[A-Za-z0-9-]{16,64}$/

type ItemSalvo = { nome: string; quantidade: number; valor: number }
function sanitizarItens(raw: unknown): ItemSalvo[] | null {
  if (!Array.isArray(raw) || raw.length > 60) return null
  const itens: ItemSalvo[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const { nome, quantidade, valor } = item as Record<string, unknown>
    const qtd = Math.trunc(Number(quantidade)); const preco = Number(valor)
    if (typeof nome !== 'string' || !nome.trim() || !Number.isFinite(qtd) || qtd < 1 || qtd > 999 || !Number.isFinite(preco) || preco < 0 || preco > 100000) return null
    itens.push({ nome: nome.trim().slice(0, 160), quantidade: qtd, valor: Math.round(preco * 100) / 100 })
  }
  return itens
}

/**
 * Public menu reports the visitor's cart as soon as it changes (Marketing > Carrinhos abandonados).
 * An empty cart (order placed or cleared) removes the entry.
 */
export async function POST(request: Request) {
  try {
    const admin = adminClient()
    if (await rateLimited(admin, request, 'cart-save', 40)) return respond({ error: 'Muitas requisições' }, 429)
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const slug = typeof body?.tenant_slug === 'string' ? body.tenant_slug : ''
    const sessionId = typeof body?.session_id === 'string' ? body.session_id : ''
    const itens = sanitizarItens(body?.itens)
    if (!slug || !SESSION.test(sessionId) || !itens) return respond({ error: 'Dados inválidos' }, 400)

    const { data: tenant } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (!tenant) return respond({ error: 'Loja não encontrada' }, 404)

    if (itens.length === 0) {
      const { error } = await admin.from('carrinho_abandonado').delete().eq('tenant_id', tenant.id).eq('session_id', sessionId)
      if (error) throw error
      return respond({ ok: true })
    }

    const total = Math.round(itens.reduce((soma, item) => soma + item.valor * item.quantidade, 0) * 100) / 100
    const nome = formatarNomeProprio(body?.cliente_nome).slice(0, 160) || null
    const whatsapp = String(body?.cliente_whatsapp ?? '').replace(/\D/g, '').slice(0, 15) || null
    const { error } = await admin.from('carrinho_abandonado').upsert({
      tenant_id: tenant.id,
      session_id: sessionId,
      itens,
      valor_total: total,
      ...(nome ? { cliente_nome: nome } : {}),
      ...(whatsapp ? { cliente_whatsapp: whatsapp } : {}),
      ultimo_acesso: new Date().toISOString(),
    }, { onConflict: 'tenant_id,session_id' })
    if (error) throw error
    return respond({ ok: true })
  } catch (error) {
    console.error('cart_save_failed', (error as { code?: string })?.code || 'unknown')
    return respond({ error: 'Não foi possível salvar o carrinho' }, 500)
  }
}
