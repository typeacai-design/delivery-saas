'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import MerchantOrderKanban from '@/components/merchant-order-kanban'
import { brasiliaDay } from '@/lib/brasilia'
import type { PedidoCozinha } from '@/lib/equipe-pedidos'
import { useEquipe } from './equipe-shell'
import { useAtualizacao, useSom } from './use-equipe'

const TIPO: Record<PedidoCozinha['tipo'], string> = { delivery: 'Delivery', retirada: 'Retirada', mesa: 'Mesa' }
const PROXIMA: Record<string, string | undefined> = { novo: 'preparando', preparando: 'pronto' }
const ROTULO_BOTAO: Record<string, string> = { novo: 'Aceitar e preparar', preparando: 'Marcar como pronto' }

function tempoDesde(iso: string, agora: number) {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

export function CartaoCozinha({ pedido, agora, onAvancar, ocupado }: { pedido: PedidoCozinha; agora: number; onAvancar?: () => void; ocupado?: boolean }) {
  return <article className="wd-eq-card">
    <div className="wd-eq-card-topo">
      <span className="wd-eq-codigo">{pedido.codigo ? `#${pedido.codigo}` : 'Pedido'}</span>
      <span className="wd-eq-tag" data-tipo={pedido.tipo}>{pedido.tipo === 'mesa' && pedido.mesa_numero ? `Mesa ${pedido.mesa_numero}` : TIPO[pedido.tipo]}</span>
    </div>
    <div className="wd-eq-meta"><span>{pedido.cliente_nome || 'Cliente'}</span><span>há {tempoDesde(pedido.criado_em, agora)}</span></div>
    <ul className="wd-eq-itens">{pedido.itens.map((item, i) => <li key={i}>
      <b>{item.quantidade}x</b>{item.nome}{item.variante ? ` · ${item.variante}` : ''}
      {item.complementos.length > 0 && <small>{item.complementos.map(c => `${c.quantidade > 1 ? `${c.quantidade}x ` : ''}${c.nome}`).join(', ')}</small>}
      {item.observacao && <small>Obs.: {item.observacao}</small>}
    </li>)}</ul>
    {pedido.observacoes && <p className="wd-eq-obs">{pedido.observacoes}</p>}
    {onAvancar && PROXIMA[pedido.status] && <button type="button" className="wd-eq-botao" onClick={onAvancar} disabled={ocupado}>{ROTULO_BOTAO[pedido.status]}</button>}
  </article>
}

/** Cozinha · Fluxo: Novo → Preparando → Pronto, arrastando o card ou pelo botão. */
export function CozinhaFluxo() {
  const { tenantId } = useEquipe()
  const [pedidos, setPedidos] = useState<PedidoCozinha[] | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const conhecidos = useRef<Set<string> | null>(null)
  const tocar = useSom()

  const carregar = useCallback(async () => {
    const r = await fetch('/api/equipe-app/cozinha?aba=fluxo', { cache: 'no-store' }).catch(() => null)
    if (!r?.ok) { setErro('Não foi possível atualizar os pedidos. Tentando de novo…'); return }
    const lista: PedidoCozinha[] = (await r.json()).pedidos || []
    // Som para pedido que chegou depois que a tela abriu.
    if (conhecidos.current && lista.some(p => !conhecidos.current!.has(p.id) && p.status !== 'pronto')) tocar()
    conhecidos.current = new Set(lista.map(p => p.id))
    setPedidos(lista); setErro('')
  }, [tocar])
  useEffect(() => { const t = window.setTimeout(() => { void carregar() }, 0); return () => window.clearTimeout(t) }, [carregar])
  useEffect(() => { const t = window.setInterval(() => setAgora(Date.now()), 30000); return () => window.clearInterval(t) }, [])
  useAtualizacao(tenantId, carregar)

  const avancar = async (pedido: PedidoCozinha, status: string) => {
    setOcupado(pedido.id)
    setPedidos(atual => atual?.map(p => p.id === pedido.id ? { ...p, status } : p) || null)
    const r = await fetch('/api/equipe-app/cozinha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido_id: pedido.id, status }) }).catch(() => null)
    if (!r?.ok) { const b = await r?.json().catch(() => ({})); setErro(b?.error || 'Não foi possível atualizar') }
    setOcupado(null); void carregar()
  }

  if (!pedidos) return <p className="wd-equipe-vazio">Carregando pedidos…</p>
  return <>
    {erro && <p className="wd-equipe-erro" role="alert">{erro}</p>}
    <MerchantOrderKanban
      columns={[{ id: 'novo', label: 'Novo' }, { id: 'preparando', label: 'Preparando' }, { id: 'pronto', label: 'Pronto' }]}
      orders={pedidos}
      nextStatusOf={p => PROXIMA[p.status] || null}
      onMove={(p, status) => avancar(p, status)}
      renderCard={p => <CartaoCozinha pedido={p} agora={agora} ocupado={ocupado === p.id} onAvancar={() => avancar(p, PROXIMA[p.status]!)} />}
    />
  </>
}

/** Cozinha · Histórico: pedidos que já saíram, foram entregues ou cancelados no período (só consulta). */
export function CozinhaHistorico() {
  const hoje = brasiliaDay()
  const [de, setDe] = useState(hoje)
  const [ate, setAte] = useState(hoje)
  const [pedidos, setPedidos] = useState<PedidoCozinha[] | null>(null)
  const [agora] = useState(() => Date.now())
  useEffect(() => {
    let ativo = true
    fetch(`/api/equipe-app/cozinha?aba=historico&de=${de}&ate=${ate}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { pedidos: [] })
      .then(b => { if (ativo) setPedidos(b.pedidos || []) }).catch(() => { if (ativo) setPedidos([]) })
    return () => { ativo = false }
  }, [de, ate])
  return <>
    <div className="wd-eq-filtro">
      <label>De<input type="date" value={de} max={ate} onChange={e => setDe(e.target.value || hoje)} /></label>
      <label>Até<input type="date" value={ate} min={de} max={hoje} onChange={e => setAte(e.target.value || hoje)} /></label>
    </div>
    {!pedidos ? <p className="wd-equipe-vazio">Carregando…</p> : pedidos.length === 0 ? <p className="wd-equipe-vazio">Nenhum pedido no período</p> :
      <div className="wd-eq-grade">{pedidos.map(p => <div key={p.id}>
        <CartaoCozinha pedido={p} agora={agora} />
        <p style={{ fontSize: 12, color: p.status === 'cancelado' ? '#a32020' : '#5d7063', margin: '4px 6px 0' }}>{p.status === 'cancelado' ? 'Cancelado' : p.status === 'saiu' ? 'Saiu para entrega' : 'Entregue'} · {new Date(p.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
      </div>)}</div>}
  </>
}
