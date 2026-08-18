import { NextRequest, NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

// GET /api/analytics?periodo=7d|30d|24h|all
// Retorna page_views agrupados por dia + total + unicos
export async function GET(req: NextRequest) {
  try {
    const { supabase, tenantId } = await authenticatedTenant(['owner', 'manager'])

    const url = new URL(req.url)
    const periodo = url.searchParams.get('periodo') || '7d'

    let desde = new Date()
    if (periodo === '24h') desde.setDate(desde.getDate() - 1)
    else if (periodo === '7d') desde.setDate(desde.getDate() - 7)
    else if (periodo === '30d') desde.setDate(desde.getDate() - 30)
    else if (periodo === 'all') desde = new Date('2000-01-01')

    const { data, error } = await supabase
      .from('page_views')
      .select('created_at, slug')
      .eq('tenant_id', tenantId)
      .gte('created_at', desde.toISOString())

    if (error) throw error

    // Agrupar por dia
    const porDia: Record<string, number> = {}
    for (const v of data || []) {
      const d = new Date(v.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      porDia[key] = (porDia[key] || 0) + 1
    }

    const total = (data || []).length

    return NextResponse.json({
      total,
      porDia: Object.entries(porDia)
        .map(([data, views]) => ({ data, views }))
        .sort((a, b) => a.data.localeCompare(b.data)),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

