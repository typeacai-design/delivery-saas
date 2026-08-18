'use client'
import { use, useEffect, useState } from 'react'
import { Star } from 'lucide-react'

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params); const [dados,setDados]=useState<any>(); const [nota,setNota]=useState(0); const [comentario,setComentario]=useState(''); const [msg,setMsg]=useState('Carregando...')
  useEffect(()=>{fetch('/api/avaliacoes/public',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}).then(async r=>({ok:r.ok,b:await r.json()})).then(x=>{x.ok?setDados(x.b):setMsg(x.b.error); if(x.ok)setMsg('')}).catch(()=>setMsg('Falha ao carregar convite.'))},[token])
  async function enviar(){if(!nota)return setMsg('Escolha uma nota.'); const r=await fetch('/api/avaliacoes/public',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,nota,comentario})});const b=await r.json();setMsg(r.ok?'Obrigado! Avaliacao enviada para moderacao.':b.error);if(r.ok)setDados(undefined)}
  const loja=(dados?.pedido?.loja as any)?.nome
  return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><section className="bg-white border rounded-2xl p-6 w-full max-w-lg shadow-sm"><h1 className="text-2xl font-bold mb-2">Avalie seu pedido</h1>{loja&&<p className="text-gray-500 mb-5">Conte como foi sua experiencia com {loja}.</p>}{dados?.ja_avaliado?<p>Este pedido ja foi avaliado.</p>:dados?.pedido?.status!=='entregue'&&dados?<p>A avaliacao sera liberada depois da entrega.</p>:dados?<><div className="flex gap-2 mb-4">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setNota(n)} aria-label={`${n} estrelas`}><Star size={34} fill={n<=nota?'#eab308':'none'} className={n<=nota?'text-yellow-500':'text-gray-300'}/></button>)}</div><textarea className="form-input" rows={4} maxLength={1000} value={comentario} onChange={e=>setComentario(e.target.value)} placeholder="Comentario (opcional)"/><button className="btn-primary mt-4" onClick={enviar}>Enviar avaliacao</button></>:null}{msg&&<p className="mt-4 text-sm text-gray-600">{msg}</p>}</section></main>
}
