'use client'
import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

type Review = { nota: number; comentario?: string | null; resposta_admin?: string | null; created_at: string; cliente_nome?: string }
type ReviewsResponse = { avaliacoes: Review[]; media: number; total: number }

export function PublicReviews({ slug }: { slug: string }) {
  const [dados, setDados] = useState<ReviewsResponse | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/avaliacoes/public?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<ReviewsResponse> : null)
      .then(result => { if (result) setDados(result) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [slug])
  if (!dados?.total) return null
  return <section className="my-8"><div className="flex items-center gap-2 mb-4"><Star fill="#eab308" className="text-yellow-500"/><h2 className="text-xl font-bold">{dados.media} de 5</h2><span className="text-sm opacity-70">({dados.total} avaliações)</span></div><div className="grid md:grid-cols-2 gap-3">{dados.avaliacoes.map((review, index)=><article key={`${review.created_at}-${index}`} className="border rounded-xl p-4 bg-white/80"><div className="flex gap-1">{[1,2,3,4,5].map(n=><Star key={n} size={15} fill={n<=review.nota?'#eab308':'none'} className={n<=review.nota?'text-yellow-500':'text-gray-300'}/>)}</div><p className="font-medium mt-2">Cliente</p>{review.comentario&&<p className="text-sm mt-1">{review.comentario}</p>}{review.resposta_admin&&<p className="text-sm mt-2 bg-green-50 rounded-lg p-2"><b>Resposta da loja:</b> {review.resposta_admin}</p>}</article>)}</div></section>
}