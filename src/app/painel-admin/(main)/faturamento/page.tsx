'use client'

import { useEffect, useState } from 'react'
import { dataFatura, nomeCompetencia, type Fatura, type SituacaoFatura } from '@/lib/assinaturas'
import { useToast } from '@/components/toast'
import { adminFetch } from '@/lib/admin-fetch'
import { formatCurrency } from '@/lib/utils'

type Estimativa = Pick<Fatura, 'valor_centavos' | 'faturamento_centavos'> & { tenant_id: string; loja: string }
type Cobrancas = {
  competencia: string
  estimativas: Estimativa[]
  faturas: (Fatura & { loja: string; situacao: SituacaoFatura })[]
  integracaoConfigurada: boolean
}

export default function CobrancasPage() {
  const { toast } = useToast()
  const [dados, setDados] = useState<Cobrancas | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    adminFetch('/api/admin/faturamento', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Não foi possível carregar as cobranças.')
      setDados(await response.json())
    }).catch(() => {
      if (controller.signal.aborted) return
      const message = 'Não foi possível carregar as cobranças.'
      setErro(message)
      toast({ type: 'error', title: message })
    })
    return () => controller.abort()
  }, [toast])

  return (
    <div className="space-y-6">
      <header className="wd-admin-page-header">
        <div>
          <h1 className="text-2xl font-semibold">Cobranças de assinatura</h1>
          <p className="hint mt-1">R$ 50 por faixa de R$ 5 mil de faturamento. Emissão no dia 5 e vencimento no dia 10.</p>
        </div>
      </header>
      {erro && <p role="alert">{erro}</p>}
      {!dados && !erro && <p role="status">Carregando cobranças…</p>}
      {dados && <>
        {!dados.integracaoConfigurada && <p className="glass-soft rounded-xl p-4">A emissão automática aguarda a configuração do Mercado Pago.</p>}
        <section className="glass-soft rounded-2xl p-4">
          <h2 className="mb-3 font-semibold">Faturas recentes</h2>
          {dados.faturas.length === 0 && <p className="hint">Nenhuma fatura registrada.</p>}
          <ul className="divide-y">
            {dados.faturas.map(fatura => (
              <li key={fatura.id} className="flex flex-wrap justify-between gap-2 py-3">
                <div><strong>{fatura.loja}</strong><p className="hint text-sm">{nomeCompetencia(fatura.competencia)} · Vence em {dataFatura(fatura.vencimento)}</p></div>
                <div className="text-right"><strong>{formatCurrency(fatura.valor_centavos / 100)}</strong><p className={fatura.situacao === 'Vencida' ? 'text-red-700 text-sm' : 'hint text-sm'}>{fatura.situacao}</p></div>
              </li>
            ))}
          </ul>
        </section>
        <section className="glass-soft rounded-2xl p-4">
          <h2 className="mb-3 font-semibold">Estimativa de {nomeCompetencia(dados.competencia)}</h2>
          {dados.estimativas.length === 0 && <p className="hint">Nenhum faturamento no mês.</p>}
          <ul className="divide-y">
            {dados.estimativas.map(loja => (
              <li key={loja.tenant_id} className="flex flex-wrap justify-between gap-2 py-3">
                <div><strong>{loja.loja}</strong><p className="hint text-sm">Faturamento de {formatCurrency(loja.faturamento_centavos / 100)}</p></div>
                <div className="text-right"><strong>{formatCurrency(loja.valor_centavos / 100)}</strong><p className="hint text-sm">Estimativa da assinatura</p></div>
              </li>
            ))}
          </ul>
        </section>
      </>}
    </div>
  )
}
