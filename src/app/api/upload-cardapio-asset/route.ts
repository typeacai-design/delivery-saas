import { authenticatedTenant } from '@/lib/tenant-auth'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const extFor = (type: string) => type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'

async function tenantContext(request: Request) {
  const bearer = request.headers.get('authorization')
  if (!bearer?.startsWith('Bearer ')) return authenticatedTenant(['owner','manager'])
  const token = bearer.slice(7).trim()
  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return { supabase: admin, tenantId: null, forbidden: false }
  const selected = request.headers.get('cookie')?.match(/(?:^|;\s*)wd_active_tenant=([^;]+)/)?.[1]
  const { data: members } = await admin.from('usuarios_loja').select('tenant_id,role').eq('user_id', user.id).eq('ativo', true)
  const ordered = [...(members || [])].sort((a: any, b: any) =>
    ((a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1)) || a.tenant_id.localeCompare(b.tenant_id)
  )
  const member = selected ? ordered.find((item: any) => item.tenant_id === decodeURIComponent(selected)) : ordered[0]
  if (!member || !['owner', 'manager'].includes(member.role)) return { supabase: admin, tenantId: null, forbidden: true }
  const { data: tenant } = await admin.from('tenants').select('status').eq('id', member.tenant_id).maybeSingle()
  return { supabase: admin, tenantId: tenant?.status === 'active' ? member.tenant_id : null, forbidden: true }
}

export async function POST(request: Request) {
  const {supabase,tenantId,forbidden}=await tenantContext(request)
  if (!tenantId) return NextResponse.json({ error: forbidden?'Sem permissao':'Nao autenticado' }, { status: forbidden?403:401 })

  try {
    const body = await request.formData()
    const file = body.get('file') as File | null
    const tipo = body.get('tipo')
    const slot = Number(body.get('slot') || 0)
    if (!file || !['logo', 'banner'].includes(String(tipo))) return NextResponse.json({ error: 'Arquivo ou tipo invalido' }, { status: 400 })
    if (tipo === 'banner' && (!Number.isInteger(slot) || slot < 0 || slot > 2)) return NextResponse.json({ error: 'Posicao de banner invalida' }, { status: 400 })
    if (!TIPOS.includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG ou WebP.' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo maior que 5MB.' }, { status: 400 })

    const path = `${tenantId}/${tipo === 'banner' ? `banner-${slot}` : 'logo'}.${extFor(file.type)}`
    const { error: uploadError } = await supabase.storage.from('cardapio-assets').upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: true })
    if (uploadError) throw uploadError
    const { data: publicData } = supabase.storage.from('cardapio-assets').getPublicUrl(path)
    let fields: Record<string, unknown>
    if (tipo === 'logo') {
      fields = { logo_url: publicData.publicUrl, logo_path: path }
    } else {
      const { data: tenant, error: readError } = await supabase.from('tenants').select('config').eq('id', tenantId).single()
      if (readError) throw readError
      const config = { ...((tenant?.config || {}) as Record<string, unknown>) }
      const banners = Array.isArray(config.cardapio_banners) ? [...config.cardapio_banners] as any[] : []
      banners[slot] = { url: publicData.publicUrl, path }
      config.cardapio_banners = banners
      fields = { config, ...(slot === 0 ? { banner_url: publicData.publicUrl, banner_path: path } : {}) }
    }
    const { error: updateError } = await supabase.from('tenants').update(fields).eq('id', tenantId)
    if (updateError) {
      await supabase.storage.from('cardapio-assets').remove([path])
      throw updateError
    }
    return NextResponse.json({ url: publicData.publicUrl, path })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro no upload' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const {supabase,tenantId,forbidden}=await tenantContext(request)
  if (!tenantId) return NextResponse.json({ error: forbidden?'Sem permissao':'Nao autenticado' }, { status: forbidden?403:401 })
  try {
    const tipo = new URL(request.url).searchParams.get('tipo')
    const slot = Number(new URL(request.url).searchParams.get('slot') || 0)
    if (!['logo', 'banner'].includes(String(tipo))) return NextResponse.json({ error: 'Tipo invalido' }, { status: 400 })
    if (tipo === 'banner' && (!Number.isInteger(slot) || slot < 0 || slot > 2)) return NextResponse.json({ error: 'Posicao de banner invalida' }, { status: 400 })
    const { data: tenant, error: readError } = await supabase.from('tenants').select('logo_path,banner_path,config').eq('id', tenantId).single()
    if (readError) throw readError
    const config = { ...(((tenant as any)?.config || {}) as Record<string, unknown>) }
    const banners = Array.isArray(config.cardapio_banners) ? [...config.cardapio_banners] as any[] : []
    const path = tipo === 'logo' ? (tenant as any)?.logo_path : banners[slot]?.path || (slot === 0 ? (tenant as any)?.banner_path : null)
    if (path && path.startsWith(`${tenantId}/`)) {
      const { error } = await supabase.storage.from('cardapio-assets').remove([path])
      if (error) throw error
    }
    if (tipo === 'banner') {
      banners[slot] = null
      config.cardapio_banners = banners
    }
    const fields = tipo === 'logo'
      ? { logo_url: null, logo_path: null }
      : { config, ...(slot === 0 ? { banner_url: null, banner_path: null } : {}) }
    const { error } = await supabase.from('tenants').update(fields).eq('id', tenantId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Erro ao remover' }, { status: 500 }) }
}






