import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AvisoPush = { titulo: string; corpo: string; url: string; tag?: string }

let configurado: boolean | null = null
function configurar() {
  if (configurado !== null) return configurado
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  configurado = Boolean(publica && privada)
  if (configurado) webpush.setVapidDetails('https://wedelivery.site', publica!, privada!)
  return configurado
}

/** Envia o aviso para todos os aparelhos inscritos desses usuários na loja. Remove inscrições expiradas. */
export async function enviarPush(admin: SupabaseClient, tenantId: string, userIds: string[], aviso: AvisoPush) {
  if (!userIds.length || !configurar()) return { enviados: 0 }
  const { data: inscricoes } = await admin.from('push_inscricoes')
    .select('id, endpoint, p256dh, auth').eq('tenant_id', tenantId).in('user_id', userIds)
  let enviados = 0
  const expiradas: string[] = []
  await Promise.all((inscricoes || []).map(async inscricao => {
    try {
      await webpush.sendNotification(
        { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
        JSON.stringify(aviso),
        { TTL: 300, urgency: 'high', topic: aviso.tag?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined },
      )
      enviados += 1
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) expiradas.push(inscricao.id)
      else console.error('push_falhou', status || 'desconhecido')
    }
  }))
  if (expiradas.length) await admin.from('push_inscricoes').delete().in('id', expiradas)
  return { enviados }
}
