import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { bearerToken, hashAccessToken, isValidCpf, normalizeCpf, rateLimited, tokenMatches } from '@/lib/customer-identity'

function adminClient() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }) }
const respond = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
type CustomerProfileRow = { nome: unknown; telefone: unknown; endereco: unknown; data_nascimento: unknown; cpf: unknown }
const profile = (data: CustomerProfileRow) => ({ nome: data.nome, telefone: data.telefone, endereco: data.endereco, data_nascimento: data.data_nascimento, cpf: data.cpf })
function validIsoDate(value: unknown) {
  if (value === null || value === undefined || value === '') return true
  const text = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(text + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text && date <= new Date()
}

export async function POST(request: Request) {
  try {
    const admin = adminClient()
    if (await rateLimited(admin, request, 'customer-profile-write', 15)) return respond({ error: 'Não foi possível processar a solicitação' }, 429)
    const { tenant_slug, nome, telefone, data_nascimento, endereco, cpf, access_token } = await request.json()
    if (!tenant_slug || !telefone || !nome || !access_token || String(access_token).length < 32) return respond({ error: 'Não foi possível processar a solicitação' }, 400)
    if (!isValidCpf(cpf)) return respond({ error: 'CPF inválido' }, 400)
    if (!validIsoDate(data_nascimento)) return respond({ error: 'Data de nascimento inválida' }, 400)
    const { data: tenant } = await admin.from('tenants').select('id').eq('slug', tenant_slug).single()
    if (!tenant) return respond({ error: 'Não foi possível processar a solicitação' }, 404)

    const token = String(access_token); const tokenHash = hashAccessToken(token)
    const { data: matches } = await admin.from('clientes').select('id,acesso_token_hash').eq('tenant_id', tenant.id).eq('acesso_token_hash', tokenHash).limit(2)
    if ((matches || []).length > 1) return respond({ error: 'Não foi possível processar a solicitação' }, 409)
    const existing = matches?.[0]
    const values = { nome: String(nome).slice(0, 160), telefone: String(telefone).replace(/\D/g, '').slice(0, 15), endereco: endereco ? String(endereco).slice(0, 500) : null, data_nascimento: data_nascimento ? String(data_nascimento) : null, cpf: cpf ? normalizeCpf(cpf) : null, acesso_token_hash: tokenHash }
    if (existing?.acesso_token_hash && !tokenMatches(token, existing.acesso_token_hash)) return respond({ error: 'Não foi possível processar a solicitação' }, 403)
    const query = existing
      ? admin.from('clientes').update(values).eq('id', existing.id)
      : admin.from('clientes').insert({ tenant_id: tenant.id, ...values, total_pedidos: 0 })
    const { data, error } = await query.select('nome,telefone,endereco,data_nascimento,cpf').single()
    if (error) throw error
    return respond(profile(data))
  } catch { console.error('customer_profile_write_failed'); return respond({ error: 'Não foi possível processar a solicitação' }, 500) }
}

export async function GET(request: Request) {
  try {
    const admin = adminClient()
    if (await rateLimited(admin, request, 'customer-profile-read')) return respond({ error: 'Não foi possível consultar o perfil' }, 429)
    const slug = new URL(request.url).searchParams.get('tenant_slug'); const token = bearerToken(request)
    if (!slug || token.length < 32) return respond({ error: 'Não foi possível consultar o perfil' }, 400)
    const { data: tenant } = await admin.from('tenants').select('id').eq('slug', slug).single()
    if (!tenant) return respond({ error: 'Não foi possível consultar o perfil' }, 404)
    const { data: matches } = await admin.from('clientes').select('nome,telefone,endereco,data_nascimento,cpf,acesso_token_hash').eq('tenant_id', tenant.id).eq('acesso_token_hash', hashAccessToken(token)).limit(2)
    const data = matches?.length === 1 ? matches[0] : null
    if (!data?.acesso_token_hash || !tokenMatches(token, data.acesso_token_hash)) return respond({ error: 'Não foi possível consultar o perfil' }, 404)
    return respond(profile(data))
  } catch { return respond({ error: 'Não foi possível consultar o perfil' }, 500) }
}
