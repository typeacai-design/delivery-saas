import { NextResponse } from 'next/server'
import { authenticatedTenant } from '@/lib/tenant-auth'

const RESERVED = new Set(['admin','api','login','dashboard','cardapio','configuracoes','suporte','registro','we-delivery','wedelivery'])
const slugify = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)
const cpfOk=(v:string)=>{if(!v)return true;if(v.length!==11||/^(\d)\1+$/.test(v))return false;const d=(n:number)=>{let s=0;for(let i=0;i<n;i++)s+=Number(v[i])*(n+1-i);const x=s*10%11;return x===10?0:x};return d(9)===Number(v[9])&&d(10)===Number(v[10])}
const out = (body: object, status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})

export async function GET(request: Request) {
  const { supabase, tenantId, forbidden } = await authenticatedTenant(['owner','manager']); if (!tenantId) return out({error:forbidden?'Sem permissão':'Não autenticado'},forbidden?403:401)
  const check = new URL(request.url).searchParams.get('slug')
  if (check !== null) {
    const slug=slugify(check); const { count }=await supabase.from('tenants').select('id',{count:'exact',head:true}).ilike('slug',slug).neq('id',tenantId)
    return out({slug,available:slug.length>=3&&!RESERVED.has(slug)&&!count,suggestions:[`${slug}-delivery`,`${slug}-${String(tenantId).slice(0,4)}`]})
  }
  // Pega TODOS os dados do cadastro para exibir em "Meu Perfil"
  const {data,error}=await supabase.from('tenants').select('nome,cpf,cnpj,categoria,tipo_estabelecimento,logo_url,telefone,endereco,numero,cidade,estado,bairro,complemento,cep,slug,email,nome_responsavel,created_at,updated_at').eq('id',tenantId).single()
  if (error) {
    console.error('Erro ao carregar tenant:', error)
    return out({error:error.message},400)
  }
  return out(data)
}

export async function PUT(request: Request) {
  const {supabase,tenantId,forbidden}=await authenticatedTenant(['owner','manager']); if(!tenantId)return out({error:forbidden?'Sem permissão':'Não autenticado'},forbidden?403:401)
  const body=await request.json(); const slug=slugify(body.slug)
  if(slug.length<3||RESERVED.has(slug))return out({error:'Slug inválido ou reservado'},400)
  const {count}=await supabase.from('tenants').select('id',{count:'exact',head:true}).ilike('slug',slug).neq('id',tenantId)
  if(count)return out({error:'Slug indisponível'},409)
  const cpf=String(body.cpf||'').replace(/\D/g,'').slice(0,11);const cnpj=String(body.cnpj||'').replace(/\D/g,'').slice(0,14)
  if(!cpfOk(cpf))return out({error:'CPF inválido'},400);if(cnpj&&cnpj.length!==14)return out({error:'CNPJ deve ter 14 dígitos'},400)
  const values={
    nome:String(body.nome||'').trim().slice(0,160),
    cpf:cpf||null,
    cnpj:cnpj||null,
    categoria:body.categoria||null,
    tipo_estabelecimento:body.categoria||null,
    telefone:String(body.telefone||'').replace(/\D/g,'').slice(0,15)||null,
    endereco:String(body.endereco||'').trim().slice(0,300)||null,
    numero:String(body.numero||'').slice(0,30)||null,
    cidade:String(body.cidade||'').slice(0,100)||null,
    estado:String(body.estado||'').slice(0,2).toUpperCase()||null,
    slug
  }
  if(!values.nome)return out({error:'Nome do negócio é obrigatório'},400)
  const {error}=await supabase.from('tenants').update(values).eq('id',tenantId)
  return error?out({error:error.message},400):out({ok:true,slug})
}
