import { NextResponse, NextRequest } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

const response = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * GET /api/configuracoes/tempo-pico
 * Retorna configuração de tempo extra em dias de pico:
 *  - tempo_base (minutos do tenant)
 *  - tempo_extra_global (min extras aplicados em dias de pico recorrentes)
 *  - dias_pico_recorrentes (por dia da semana)
 *  - datas_especificas (datas pontuais com motivo)
 */
export async function GET() {
  const { supabase, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!tenantId) return response({ error: forbidden ? 'Sem permissão' : 'Não autenticado' }, forbidden ? 403 : 401)

  const [{ data: tenant, error: e1 }, { data: picos, error: e2 }] = await Promise.all([
    supabase.from('tenants').select('tempo_preparo_extra_minutos').eq('id', tenantId).single(),
    supabase.from('dias_pico').select('id, dia_semana, data, tempo_extra_minutos, motivo').eq('tenant_id', tenantId).order('data', { ascending: true }),
  ])

  if (e1) return response({ error: e1.message }, 500)
  if (e2) return response({ error: e2.message }, 500)

  const recorrentes = (picos || []).filter((p: any) => p.dia_semana).map((p: any) => ({
    id: p.id,
    dia_semana: p.dia_semana,
    tempo_extra_minutos: p.tempo_extra_minutos,
  }))

  const especificas = (picos || []).filter((p: any) => p.data && !p.dia_semana).map((p: any) => ({
    id: p.id,
    data: p.data,
    tempo_extra_minutos: p.tempo_extra_minutos,
    motivo: p.motivo,
  }))

  return response({
    tempo_extra_global: tenant?.tempo_preparo_extra_minutos ?? 0,
    dias_pico_recorrentes: recorrentes,
    datas_especificas: especificas,
  })
}

/**
 * POST /api/configuracoes/tempo-pico
 * Body: { tipo: 'global'|'recorrente'|'especifica', ... }
 */
export async function POST(req: NextRequest) {
  const { supabase, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!tenantId) return response({ error: forbidden ? 'Sem permissão' : 'Não autenticado' }, forbidden ? 403 : 401)

  const body = await req.json().catch(() => null)
  if (!body) return response({ error: 'Body inválido' }, 400)

  if (body.tipo === 'global') {
    const n = Math.max(0, Math.min(240, Number(body.tempo_preparo_extra_minutos) || 0))
    const { error } = await supabase
      .from('tenants')
      .update({ tempo_preparo_extra_minutos: n })
      .eq('id', tenantId)
    if (error) return response({ error: error.message }, 500)
    return response({ ok: true, tempo_preparo_extra_minutos: n })
  }

  if (body.tipo === 'recorrente') {
    const { dia_semana, tempo_extra_minutos } = body
    if (!['seg','ter','qua','qui','sex','sab','dom'].includes(dia_semana)) {
      return response({ error: 'dia_semana inválido' }, 400)
    }
    // Upsert: se já existe para esse dia, atualiza; senão cria
    const { data, error } = await supabase
      .from('dias_pico')
      .upsert(
        {
          tenant_id: tenantId,
          dia_semana,
          data: null,
          tempo_extra_minutos: Math.max(0, Math.min(240, Number(tempo_extra_minutos) || 0)),
          motivo: null,
        },
        { onConflict: 'tenant_id,dia_semana', ignoreDuplicates: false }
      )
      .select()
      .single()
    if (error) return response({ error: error.message }, 500)
    return response({ ok: true, dia: data })
  }

  if (body.tipo === 'especifica') {
    const { data: dataStr, tempo_extra_minutos, motivo } = body
    if (!dataStr) return response({ error: 'data obrigatória' }, 400)
    const { data, error } = await supabase
      .from('dias_pico')
      .upsert(
        {
          tenant_id: tenantId,
          data: dataStr,
          dia_semana: null,
          tempo_extra_minutos: Math.max(0, Math.min(240, Number(tempo_extra_minutos) || 0)),
          motivo: motivo || null,
        },
        { onConflict: 'tenant_id,data', ignoreDuplicates: false }
      )
      .select()
      .single()
    if (error) return response({ error: error.message }, 500)
    return response({ ok: true, dia: data })
  }

  return response({ error: 'tipo inválido' }, 400)
}

/**
 * DELETE /api/configuracoes/tempo-pico?id=<uuid>
 */
export async function DELETE(req: NextRequest) {
  const { supabase, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!tenantId) return response({ error: forbidden ? 'Sem permissão' : 'Não autenticado' }, forbidden ? 403 : 401)

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return response({ error: 'id obrigatório' }, 400)

  const { error } = await supabase
    .from('dias_pico')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return response({ error: error.message }, 500)
  return response({ ok: true })
}
