import { equipeAutenticada, respostaEquipe } from '@/lib/equipe-server'

type Inscricao = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

/** Guarda a inscrição de notificação deste aparelho (Cozinha, Garçom ou Motoboy). */
export async function POST(request: Request) {
  const ctx = await equipeAutenticada(['kitchen', 'attendant', 'motoboy'])
  if ('erro' in ctx) return ctx.erro
  const body = await request.json().catch(() => null) as Inscricao | null
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : ''
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return respostaEquipe({ error: 'Inscrição inválida' }, 400)
  const { error } = await ctx.admin.from('push_inscricoes').upsert({ endpoint, p256dh, auth, user_id: ctx.userId, tenant_id: ctx.tenantId }, { onConflict: 'endpoint' })
  if (error) return respostaEquipe({ error: 'Não foi possível ativar as notificações' }, 500)
  return respostaEquipe({ ok: true })
}

export async function DELETE(request: Request) {
  const ctx = await equipeAutenticada(['kitchen', 'attendant', 'motoboy'])
  if ('erro' in ctx) return ctx.erro
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null
  if (typeof body?.endpoint === 'string') await ctx.admin.from('push_inscricoes').delete().eq('endpoint', body.endpoint).eq('user_id', ctx.userId)
  return respostaEquipe({ ok: true })
}
