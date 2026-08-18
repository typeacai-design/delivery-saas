import { authenticatedTenant } from '@/lib/tenant-auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const {supabase,user,tenantId,forbidden}=await authenticatedTenant(['owner','manager'])
  if (!tenantId || !user) return NextResponse.json({ error: forbidden?'Sem permissão':'Não autenticado' }, { status: forbidden?403:401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo
    const tiposValidos = ['image/jpeg', 'image/png', 'image/webp']
    if (!tiposValidos.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo inválido. Use JPG, PNG ou WebP.' }, { status: 400 })
    }

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo: 2MB.' }, { status: 400 })
    }

    // Extrair extensão do MIME type
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${tenantId}/logo.${ext}`

    // Converter para ArrayBuffer
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Upload para Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, bytes, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Erro no upload:', uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload: ' + uploadError.message }, { status: 500 })
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)

    // Salvar URL no tenant
    await supabase
      .from('tenants')
      .update({ logo_url: urlData.publicUrl })
      .eq('id', tenantId)

    return NextResponse.json({ url: urlData.publicUrl, path })
  } catch (error: any) {
    console.error('Erro geral:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE() {
  const {supabase,user,tenantId,forbidden}=await authenticatedTenant(['owner','manager'])
  if (!tenantId || !user) return NextResponse.json({ error: forbidden?'Sem permissão':'Não autenticado' }, { status: forbidden?403:401 })

  try {
    // Tenta deletar qualquer extensão
    for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
      await supabase.storage.from('logos').remove([`${tenantId}/logo.${ext}`])
    }

    // Remove URL do tenant
    await supabase
      .from('tenants')
      .update({ logo_url: null })
      .eq('id', tenantId)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
