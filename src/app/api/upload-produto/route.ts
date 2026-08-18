/* eslint-disable @typescript-eslint/no-explicit-any */
import { authenticatedTenant } from '@/lib/tenant-auth'
import { NextResponse } from 'next/server'

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const extension = (type: string) => type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/gif' ? 'gif' : 'jpg'

export async function POST(request: Request) {
  const { supabase, user, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!user || !tenantId) return NextResponse.json({ error: forbidden ? 'Sem permissao' : 'Nao autenticado' }, { status: forbidden ? 403 : 401 })
  try {
    const file = (await request.formData()).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG, WebP ou GIF.' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo maior que 5MB.' }, { status: 400 })
    const path = `${tenantId}/produtos/${crypto.randomUUID()}.${extension(file.type)}`
    const { error } = await supabase.storage.from('produtos').upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('produtos').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path })
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 }) }
}

export async function DELETE(request: Request) {
  const { supabase, user, tenantId, forbidden } = await authenticatedTenant(['owner', 'manager'])
  if (!user || !tenantId) return NextResponse.json({ error: forbidden ? 'Sem permissao' : 'Nao autenticado' }, { status: forbidden ? 403 : 401 })
  const path = new URL(request.url).searchParams.get('path')
  if (!path?.startsWith(`${tenantId}/produtos/`)) return NextResponse.json({ error: 'Path invalido' }, { status: 400 })
  const { error } = await supabase.storage.from('produtos').remove([path])
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true })
}