import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/track-view?slug=xxx
// Conta uma visita ao cardápio (analytics)
export async function POST(req: NextRequest) {
  try {
    const { slug, path, referrer } = await req.json().catch(() => ({}))
    if (!slug) {
      return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Achar tenant_id pelo slug
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'slug não encontrado' }, { status: 404 })
    }

    const userAgent = req.headers.get('user-agent') || null
    await admin.from('page_views').insert({
      tenant_id: tenant.id,
      slug,
      path: path || `/cardapio/${slug}`,
      referrer: referrer || null,
      user_agent: userAgent,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
