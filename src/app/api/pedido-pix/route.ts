import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { bearerToken, hashAccessToken, rateLimited, tokenMatches } from '@/lib/customer-identity'
import { gerarBrCodePix } from '@/lib/pix/gerar-brcode'
import QRCode from 'qrcode'

const out = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
function admin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }) }

export async function POST(request: Request) {
  try {
    const supa = admin()
    if (await rateLimited(supa, request, 'customer-pix-read', 12)) return out({ error: 'Não foi possível gerar o PIX' }, 429)
    const token = bearerToken(request)
    const { pedido_id } = await request.json().catch(() => ({ pedido_id: null }))
    if (!pedido_id || token.length < 32) return out({ error: 'Não foi possível gerar o PIX' }, 400)
    const { data: pedido } = await supa.from('pedidos').select('id,tenant_id,valor_total,cliente_acesso_token_hash').eq('id', pedido_id).maybeSingle()
    if (!pedido?.cliente_acesso_token_hash || !tokenMatches(token, pedido.cliente_acesso_token_hash) || hashAccessToken(token) !== pedido.cliente_acesso_token_hash) return out({ error: 'Pedido não encontrado' }, 404)
    const { data: pixConfig } = await supa.from('saas_config').select('valor').eq('chave', 'pix').single()
    if (!pixConfig?.valor?.chave) return out({ error: 'PIX indisponível no momento' }, 503)
    const txid = `PED${pedido.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`
    const valor = Number(pedido.valor_total) || 0
    const brCode = gerarBrCodePix({ chave: pixConfig.valor.chave, nomeRecebedor: pixConfig.valor.nome_recebedor || 'We Delivery', cidade: pixConfig.valor.cidade || 'SAO PAULO', valor, txid })
    const qrCodeBase64 = await QRCode.toDataURL(brCode, { width: 400, margin: 1 })
    return out({ txid, br_code: brCode, qr_code_base64: qrCodeBase64, valor })
  } catch { console.error('customer_pix_generation_failed'); return out({ error: 'Não foi possível gerar o PIX' }, 500) }
}