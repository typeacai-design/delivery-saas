'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, QrCode, Search, UtensilsCrossed, X } from 'lucide-react'
import LeitorQr from './leitor-qr'
import { brasiliaDay } from '@/lib/brasilia'
import { formatCurrency } from '@/lib/utils'
import { useEquipe } from './equipe-shell'
import { useAtualizacao, useSom } from './use-equipe'

type PedidoMesa = { id: string; codigo: string | null; status: string; valor_total: number; cliente_nome: string | null; itens: { nome: string; quantidade: number }[] }
type Mesa = { mesa: { id: string; numero: number; nome: string | null; qr_token: string }; sessao: { id: string; cliente_nome: string | null; valor_total: number; data_abertura: string } | null; pedidos: PedidoMesa[]; prontos: number }
const STATUS: Record<string, string> = { novo: 'Aguardando cozinha', preparando: 'Preparando', pronto: 'Pronto para servir', entregue: 'Servido', cancelado: 'Cancelado' }
const FORMAS = [{ id: 'dinheiro', label: 'Dinheiro' }, { id: 'pix', label: 'Pix' }, { id: 'cartao_credito', label: 'Crédito' }, { id: 'cartao_debito', label: 'Débito' }]

async function acao(corpo: Record<string, unknown>) {
  const r = await fetch('/api/equipe-app/garcom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).catch(() => null)
  const b = await r?.json().catch(() => ({}))
  return r?.ok ? null : (b?.error || 'Não foi possível concluir')
}

/** Garçom · Mesas: comandas, aviso de prato pronto, "Servido" e fechamento da conta. */
export function GarcomMesas() {
  const { tenantId } = useEquipe()
  const [mesas, setMesas] = useState<Mesa[] | null>(null)
  const [slug, setSlug] = useState('')
  const [erro, setErro] = useState('')
  const [abrindo, setAbrindo] = useState<Mesa | null>(null)
  const [nomeCliente, setNomeCliente] = useState('')
  const [fechando, setFechando] = useState<Mesa | null>(null)
  const [forma, setForma] = useState('dinheiro')
  const [recebido, setRecebido] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [foco, setFoco] = useState<string | null>(null)
  const [numeroBusca, setNumeroBusca] = useState('')
  const [lendoQr, setLendoQr] = useState(false)
  const prontosVistos = useRef<Set<string> | null>(null)
  const tocar = useSom()

  const carregar = useCallback(async () => {
    const r = await fetch('/api/equipe-app/garcom', { cache: 'no-store' }).catch(() => null)
    if (!r?.ok) { setErro('Não foi possível atualizar as mesas. Tentando de novo…'); return }
    const b = await r.json()
    const lista: Mesa[] = b.mesas || []
    const prontos = new Set(lista.flatMap(m => m.pedidos.filter(p => p.status === 'pronto').map(p => p.id)))
    if (prontosVistos.current && [...prontos].some(id => !prontosVistos.current!.has(id))) tocar()
    prontosVistos.current = prontos
    setMesas(lista); setSlug(b.slug || ''); setErro('')
  }, [tocar])
  useEffect(() => { const t = window.setTimeout(() => { void carregar() }, 0); return () => window.clearTimeout(t) }, [carregar])
  useAtualizacao(tenantId, carregar)

  const executar = async (corpo: Record<string, unknown>, depois?: () => void) => {
    setOcupado(true); const falha = await acao(corpo); setOcupado(false)
    if (falha) setErro(falha); else depois?.()
    void carregar()
  }

  // Mostra só a mesa encontrada; se estiver livre, já oferece abrir a comanda.
  const irParaMesa = (m: Mesa | undefined, origem: string) => {
    if (!m) { setErro(origem === 'qr' ? 'Este QR não é de uma mesa ativa desta loja.' : `Mesa ${numeroBusca} não encontrada.`); return }
    setErro(''); setFoco(m.mesa.id); setNumeroBusca('')
    if (!m.sessao) { setAbrindo(m); setNomeCliente('') }
  }
  const buscarNumero = (e: React.FormEvent) => {
    e.preventDefault()
    const numero = Number(numeroBusca)
    if (numero > 0) irParaMesa(mesas?.find(m => Number(m.mesa.numero) === numero), 'numero')
  }
  const qrLido = (texto: string) => {
    setLendoQr(false)
    let token = ''
    try { token = new URL(texto, window.location.origin).searchParams.get('mesa') || '' } catch { /* texto não é link */ }
    irParaMesa(token ? mesas?.find(m => m.mesa.qr_token === token) : undefined, 'qr')
  }

  if (!mesas) return <p className="wd-equipe-vazio">Carregando mesas…</p>
  if (!mesas.length) return <p className="wd-equipe-vazio">Nenhuma mesa cadastrada. Peça ao responsável para cadastrar em Configurações → Mesas.</p>
  const prontosTotal = mesas.reduce((s, m) => s + m.prontos, 0)
  const totalFechando = fechando?.sessao ? Number(fechando.sessao.valor_total) || 0 : 0
  const troco = forma === 'dinheiro' && Number(recebido.replace(',', '.')) > totalFechando ? Number(recebido.replace(',', '.')) - totalFechando : 0

  const visiveis = foco ? mesas.filter(m => m.mesa.id === foco) : mesas

  return <>
    <form className="wd-eq-busca" onSubmit={buscarNumero}>
      <input inputMode="numeric" pattern="[0-9]*" placeholder="Mesa nº" aria-label="Número da mesa" value={numeroBusca} onChange={e => setNumeroBusca(e.target.value.replace(/D/g, '').slice(0, 4))} />
      <button type="submit" aria-label="Ir para a mesa"><Search size={18} /></button>
      <button type="button" className="wd-eq-busca-qr" onClick={() => setLendoQr(true)}><QrCode size={18} />Escanear QR</button>
    </form>
    {foco && <button type="button" className="wd-eq-botao-sec" style={{ marginTop: 0, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setFoco(null)}><X size={16} />Ver todas as mesas</button>}
    {erro && <p className="wd-equipe-erro" role="alert">{erro}</p>}
    {prontosTotal > 0 && <div className="wd-eq-pronto" role="status">🍽️ {prontosTotal} {prontosTotal === 1 ? 'pedido pronto' : 'pedidos prontos'} para servir</div>}
    <div className="wd-eq-grade">{visiveis.map(m => <article key={m.mesa.id} className="wd-eq-card wd-eq-mesa" data-pronto={m.prontos > 0}>
      <div className="wd-eq-card-topo">
        <span className="wd-eq-codigo">Mesa {m.mesa.numero}</span>
        <span className="wd-eq-tag" data-tipo={m.sessao ? 'mesa' : undefined}>{m.sessao ? 'Ocupada' : 'Livre'}</span>
      </div>
      {m.mesa.nome && <p className="wd-eq-meta"><span>{m.mesa.nome}</span></p>}
      {!m.sessao ? <button type="button" className="wd-eq-botao" onClick={() => { setAbrindo(m); setNomeCliente('') }}>Abrir comanda</button> : <>
        <div className="wd-eq-meta"><span>{m.sessao.cliente_nome || 'Cliente'}</span><strong>{formatCurrency(Number(m.sessao.valor_total) || 0)}</strong></div>
        {m.prontos > 0 && <div className="wd-eq-pronto">🍽️ {m.prontos} pronto{m.prontos > 1 ? 's' : ''} para servir</div>}
        {m.pedidos.length === 0 ? <p className="wd-eq-meta">Nenhum pedido ainda</p> : m.pedidos.map(p => <div key={p.id} style={{ borderTop: '1px solid #eef2ef', paddingTop: 8, marginTop: 8 }}>
          <div className="wd-eq-linha"><strong>{p.codigo ? `#${p.codigo}` : 'Pedido'}</strong><span style={{ color: p.status === 'pronto' ? '#166534' : '#5d7063', fontWeight: p.status === 'pronto' ? 700 : 400 }}>{STATUS[p.status] || p.status}</span></div>
          <p style={{ fontSize: 13, color: '#5d7063', margin: 0 }}>{p.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}</p>
          {p.status === 'pronto' && <button type="button" className="wd-eq-botao" disabled={ocupado} onClick={() => executar({ acao: 'servido', pedido_id: p.id })}>Servido</button>}
        </div>)}
        {slug && <a className="wd-eq-botao-sec" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} href={`/cardapio/${encodeURIComponent(slug)}?mesa=${m.mesa.qr_token}`} target="_blank" rel="noopener"><UtensilsCrossed size={16} />Lançar pedido<ExternalLink size={14} /></a>}
        <button type="button" className="wd-eq-botao-sec" onClick={() => { setFechando(m); setForma('dinheiro'); setRecebido('') }}>Fechar conta</button>
      </>}
    </article>)}</div>

    {lendoQr && <LeitorQr onLido={qrLido} onFechar={() => setLendoQr(false)} />}

    {abrindo && <div className="wd-eq-modal" onClick={() => setAbrindo(null)}><div role="dialog" aria-modal="true" aria-label={`Abrir comanda da mesa ${abrindo.mesa.numero}`} onClick={e => e.stopPropagation()}>
      <strong style={{ fontSize: 18 }}>Abrir Mesa {abrindo.mesa.numero}</strong>
      <input autoFocus placeholder="Nome do cliente (opcional)" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
      <button type="button" className="wd-eq-botao" disabled={ocupado} onClick={() => executar({ acao: 'abrir', mesa_id: abrindo.mesa.id, cliente_nome: nomeCliente }, () => setAbrindo(null))}>Abrir comanda</button>
      <button type="button" className="wd-eq-botao-sec" onClick={() => setAbrindo(null)}>Cancelar</button>
    </div></div>}

    {fechando?.sessao && <div className="wd-eq-modal" onClick={() => !ocupado && setFechando(null)}><div role="dialog" aria-modal="true" aria-label={`Fechar conta da mesa ${fechando.mesa.numero}`} onClick={e => e.stopPropagation()}>
      <strong style={{ fontSize: 18 }}>Fechar conta · Mesa {fechando.mesa.numero}</strong>
      <div className="wd-eq-linha"><span>Total</span><strong style={{ fontSize: 20 }}>{formatCurrency(totalFechando)}</strong></div>
      {fechando.pedidos.some(p => ['novo', 'preparando', 'pronto'].includes(p.status)) && <p className="wd-eq-obs">Atenção: ainda há pedido desta mesa não servido.</p>}
      <div className="wd-eq-formas">{FORMAS.map(f => <button type="button" key={f.id} aria-pressed={forma === f.id} onClick={() => setForma(f.id)}>{f.label}</button>)}</div>
      {forma === 'dinheiro' && <>
        <input inputMode="decimal" placeholder={`Valor recebido (ex.: ${totalFechando.toFixed(2).replace('.', ',')})`} value={recebido} onChange={e => setRecebido(e.target.value.replace(/[^0-9.,]/g, ''))} />
        {troco > 0 && <div className="wd-eq-linha"><span>Troco</span><strong>{formatCurrency(troco)}</strong></div>}
      </>}
      <button type="button" className="wd-eq-botao" disabled={ocupado} onClick={() => executar({ acao: 'fechar', sessao_id: fechando.sessao!.id, forma_pagamento: forma, valor_pago: forma === 'dinheiro' && recebido ? Number(recebido.replace(',', '.')) : null }, () => setFechando(null))}>{ocupado ? 'Fechando…' : 'Confirmar pagamento e fechar'}</button>
      <button type="button" className="wd-eq-botao-sec" onClick={() => setFechando(null)} disabled={ocupado}>Voltar</button>
    </div></div>}
  </>
}

type Comanda = { id: string; mesa_numero: string; cliente_nome: string | null; valor_total: number; forma_pagamento: string | null; data_fechamento: string; fechada_por: string | null }
const NOME_FORMA: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Crédito', cartao_debito: 'Débito' }

/** Garçom · Histórico: comandas fechadas no período. */
export function GarcomHistorico() {
  const hoje = brasiliaDay()
  const [de, setDe] = useState(hoje)
  const [ate, setAte] = useState(hoje)
  const [comandas, setComandas] = useState<Comanda[] | null>(null)
  useEffect(() => {
    let ativo = true
    fetch(`/api/equipe-app/garcom?aba=historico&de=${de}&ate=${ate}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { comandas: [] })
      .then(b => { if (ativo) setComandas(b.comandas || []) }).catch(() => { if (ativo) setComandas([]) })
    return () => { ativo = false }
  }, [de, ate])
  return <>
    <div className="wd-eq-filtro">
      <label>De<input type="date" value={de} max={ate} onChange={e => setDe(e.target.value || hoje)} /></label>
      <label>Até<input type="date" value={ate} min={de} max={hoje} onChange={e => setAte(e.target.value || hoje)} /></label>
    </div>
    {!comandas ? <p className="wd-equipe-vazio">Carregando…</p> : comandas.length === 0 ? <p className="wd-equipe-vazio">Nenhuma conta fechada no período</p> :
      <div className="wd-eq-grade">{comandas.map(c => <article key={c.id} className="wd-eq-card">
        <div className="wd-eq-card-topo"><span className="wd-eq-codigo">Mesa {c.mesa_numero}</span><strong>{formatCurrency(Number(c.valor_total) || 0)}</strong></div>
        <div className="wd-eq-meta"><span>{c.cliente_nome || 'Cliente'}</span><span>{c.forma_pagamento ? NOME_FORMA[c.forma_pagamento] || c.forma_pagamento : ''}</span></div>
        <p style={{ fontSize: 12, color: '#5d7063', margin: 0 }}>Fechada {new Date(c.data_fechamento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{c.fechada_por ? ` por ${c.fechada_por}` : ''}</p>
      </article>)}</div>}
  </>
}
