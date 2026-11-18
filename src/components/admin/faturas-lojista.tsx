'use client'

import { useEffect, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import { dataBrasilia, dataFatura, nomeCompetencia, type SituacaoFatura } from '@/lib/assinaturas'
import { formatCurrency } from '@/lib/utils'

type Linha = {
  id: string; competencia: string; valor_centavos: number; vencimento: string;
  pago_em: string | null; situacao: SituacaoFatura; baixaManual: boolean;
}
const erroConsulta = 'Não foi possível consultar as faturas.'

export default function FaturasLojista({ loja, onBaixa }: { loja: string; onBaixa: () => void }) {
  const [faturas, setFaturas] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const lock = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    adminFetch('/api/admin/faturas-lojista?loja=' + encodeURIComponent(loja), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw Error(erroConsulta)
        setFaturas((await response.json()).faturas)
      }).catch(() => { if (!controller.signal.aborted) setErro(erroConsulta) })
    return () => controller.abort()
  }, [loja])

  async function marcar(fatura: Linha) {
    if (lock.current || !window.confirm(`Confirma o recebimento de ${formatCurrency(fatura.valor_centavos / 100)} da fatura de ${nomeCompetencia(fatura.competencia)}?`)) return
    lock.current = true
    setSalvando(fatura.id)
    setAviso('')
    setErro('')
    try {
      const response = await adminFetch('/api/admin/faturas-lojista', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loja, fatura: fatura.id }),
      })
      const resultado = await response.json()
      if (!response.ok) throw Error(resultado.error || 'Não foi possível registrar a baixa.')
      setFaturas(lista => lista?.map(item => item.id === fatura.id ? resultado.fatura : item) ?? null)
      setAviso(resultado.registrada ? 'Baixa manual registrada.' : 'Esta fatura já estava paga.')
      onBaixa()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar a baixa.')
    } finally {
      lock.current = false
      setSalvando(null)
    }
  }

  return (
    <section className="space-y-3 border-t pt-4" aria-label="Faturas da assinatura">
      <h4 className="font-semibold">Faturas da assinatura</h4>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {aviso && <p role="status" className="text-sm text-green-800">{aviso}</p>}
      {!faturas && !erro && <p role="status" className="hint text-sm">Carregando faturas…</p>}
      {faturas?.length === 0 && <p className="hint text-sm">Nenhuma fatura emitida para esta loja.</p>}
      {faturas?.map(fatura => (
        <article key={fatura.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <strong>{nomeCompetencia(fatura.competencia)} · {formatCurrency(fatura.valor_centavos / 100)}</strong>
            <p className="hint text-sm">Vencimento em {dataFatura(fatura.vencimento)} · {fatura.situacao}</p>
            {fatura.pago_em && <p className="hint text-sm">Pagamento em {dataFatura(dataBrasilia(new Date(fatura.pago_em)))}{fatura.baixaManual ? ' · Baixa manual' : ''}</p>}
          </div>
          {!fatura.pago_em && <button type="button" className="btn-primary" disabled={Boolean(salvando)} onClick={() => void marcar(fatura)}>
            {salvando === fatura.id ? 'Registrando…' : 'Marcar como paga'}
          </button>}
        </article>
      ))}
    </section>
  )
}
