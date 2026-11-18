'use client'

import { useEffect, useState } from 'react'
import { dataFatura, nomeCompetencia, type Fatura, type SituacaoFatura } from '@/lib/assinaturas'
import { formatCurrency } from '@/lib/utils'

type FaturaExibida = Pick<Fatura, 'id' | 'competencia' | 'vencimento' | 'valor_centavos'> & { situacao: SituacaoFatura }

export default function FaturasAssinatura() {
  const [faturas, setFaturas] = useState<FaturaExibida[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function atualizar() {
      try {
        const response = await fetch('/api/assinaturas', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw Error('assinaturas_indisponiveis')
        const dados = await response.json()
        setFaturas(dados.faturas)
        setErro(false)
      } catch {
        if (!controller.signal.aborted) setErro(true)
      }
    }
    void atualizar()
    const timer = setInterval(atualizar, 30_000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [])

  return <div className="my-3 space-y-2">
    <h3 className="text-sm font-semibold">Faturas do We Delivery</h3>
    {erro && <p role="alert" className="text-sm">Não foi possível consultar as faturas.</p>}
    {!erro && !faturas && <p role="status" className="hint text-sm">Carregando faturas…</p>}
    {!erro && faturas?.length === 0 && <p className="hint text-sm">Nenhuma fatura disponível.</p>}
    {faturas?.map(fatura => (
      <article key={fatura.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
        <div>
          <strong className="text-sm">Assinatura · {nomeCompetencia(fatura.competencia)}</strong>
          <p className="hint text-sm">Vencimento em {dataFatura(fatura.vencimento)} · {fatura.situacao}</p>
        </div>
        <div className="flex items-center gap-3">
          <strong>{formatCurrency(fatura.valor_centavos / 100)}</strong>
          {fatura.situacao !== 'Paga' && <a href={`/api/assinaturas/pagar?id=${fatura.id}`} className="btn-primary">Pagar no Mercado Pago</a>}
        </div>
      </article>
    ))}
  </div>
}
