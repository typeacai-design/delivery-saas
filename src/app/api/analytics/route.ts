import { NextRequest, NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'
import { brasiliaDay } from '@/lib/brasilia'

// GET /api/analytics?periodo=7d|30d|24h|all
// Retorna page_views agrupados por dia + total + unicos
export async function GET(req: NextRequest) {
  try {
    const { supabase, tenantId } = await authenticatedTenant(['owner', 'manager'])

    const url = new URL(req.url)
    const periodo = url.searchParams.get('periodo') || '7d'

    if(!tenantId)return NextResponse.json({error:'Sem permissão'},{status:403})
    if(!['24h','7d','30d','all'].includes(periodo))return NextResponse.json({error:'Período inválido'},{status:400})
    const desde=periodo==='all'?new Date('2000-01-01'):new Date(Date.now()-({'24h':1,'7d':7,'30d':30}[periodo as '24h'|'7d'|'30d'])*86400000)
    const data:{created_at:string}[]=[]
    for(let offset=0;;offset+=250){
      const r=await supabase.from('page_views').select('created_at').eq('tenant_id',tenantId).gte('created_at',desde.toISOString()).order('id').range(offset,offset+249)
      if(r.error)throw r.error;data.push(...(r.data||[]));if(!r.data||r.data.length<250)break
    }

    // Agrupar por dia
    const porDia: Record<string, number> = {}
    for (const v of data || []) {
      const d = new Date(v.created_at)
      const key = brasiliaDay(d)
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

