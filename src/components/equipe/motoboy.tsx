'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapPin, Phone } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useEquipe } from './equipe-shell'
import { useAtualizacao, useSom } from './use-equipe'

type Entrega = {
  id: string; codigo: string | null; status: string; bairro: string | null; endereco: string | null; numero: string | null; complemento: string | null; criado_em: string
  cliente_nome?: string | null; telefone?: string | null; forma_pagamento?: string[] | string | null; troco_para?: number | null; valor_total?: number; pago?: boolean; observacoes?: string | null
}
type Painel = { modo: string; disponivel: boolean; entreguesHoje: number; minhas: Entrega[]; paraPegar: Entrega[] }
const NOME_FORMA: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito', cartao: 'Cartão' }

const enderecoCompleto = (e: Entrega) => [e.endereco, e.numero, e.bairro].filter(Boolean).join(', ')
const linkMapa = (e: Entrega) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto(e))}`
const formas = (f: Entrega['forma_pagamento']) => (Array.isArray(f) ? f : f ? [f] : []).map(x => NOME_FORMA[x] || x).join(' + ')

/** Motoboy: Disponível/Inativo, entregas para pegar (quando a loja deixa escolher) e as entregas dele. */
export function MotoboyPainel() {
  const { tenantId } = useEquipe()
  const [painel, setPainel] = useState<Painel | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const vistas = useRef<Set<string> | null>(null)
  const tocar = useSom()

  const carregar = useCallback(async () => {
    const r = await fetch('/api/equipe-app/motoboy', { cache: 'no-store' }).catch(() => null)
    if (!r?.ok) { setErro('Não foi possível atualizar. Tentando de novo…'); return }
    const b: Painel = await r.json()
    const ids = new Set([...b.minhas, ...b.paraPegar].map(e => e.id))
    if (vistas.current && [...ids].some(id => !vistas.current!.has(id))) tocar()
    vistas.current = ids
    setPainel(b); setErro('')
  }, [tocar])
  useEffect(() => { const t = window.setTimeout(() => { void carregar() }, 0); return () => window.clearTimeout(t) }, [carregar])
  useAtualizacao(tenantId, carregar)

  const alternarDisponivel = async () => {
    if (!painel) return
    const disponivel = !painel.disponivel
    setPainel({ ...painel, disponivel })
    const r = await fetch('/api/equipe-app/eu', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disponivel }) }).catch(() => null)
    if (!r?.ok) setErro('Não foi possível mudar sua disponibilidade')
    void carregar()
  }
  const executar = async (acao: string, entrega: Entrega) => {
    if (acao === 'entregue' && !confirm(`Confirmar que o pedido ${entrega.codigo ? '#' + entrega.codigo : ''} foi entregue?`)) return
    setOcupado(entrega.id)
    const r = await fetch('/api/equipe-app/motoboy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, pedido_id: entrega.id }) }).catch(() => null)
    if (!r?.ok) { const b = await r?.json().catch(() => ({})); setErro(b?.error || 'Não foi possível concluir') }
    setOcupado(null); void carregar()
  }

  if (!painel) return <p className="wd-equipe-vazio">Carregando…</p>
  return <>
    {erro && <p className="wd-equipe-erro" role="alert">{erro}</p>}
    <div className="wd-eq-interruptor" data-ativo={painel.disponivel}>
      <div><strong>{painel.disponivel ? 'Disponível' : 'Inativo'}</strong><p style={{ margin: 0, fontSize: 13, color: '#5d7063' }}>{painel.disponivel ? 'Você recebe novas entregas' : 'Você não recebe novas entregas'} · {painel.entreguesHoje} entregue{painel.entreguesHoje === 1 ? '' : 's'} hoje</p></div>
      <button type="button" className="wd-eq-botao" style={{ width: 'auto', marginTop: 0, padding: '0 18px', background: painel.disponivel ? '#5d7063' : '#16a34a' }} onClick={alternarDisponivel}>{painel.disponivel ? 'Ficar inativo' : 'Ficar disponível'}</button>
    </div>

    <h2 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 10px' }}>Minhas entregas</h2>
    {painel.minhas.length === 0 ? <p className="wd-equipe-vazio" style={{ paddingTop: 12 }}>{painel.disponivel ? 'Nenhuma entrega com você agora' : 'Fique disponível para receber entregas'}</p> :
      <div className="wd-eq-grade">{painel.minhas.map(e => <article key={e.id} className="wd-eq-card">
        <div className="wd-eq-card-topo"><span className="wd-eq-codigo">{e.codigo ? `#${e.codigo}` : 'Entrega'}</span><span className="wd-eq-tag" data-tipo="delivery">{e.status === 'saiu' ? 'Em rota' : 'Retirar na loja'}</span></div>
        <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{e.cliente_nome || 'Cliente'}</p>
        <p style={{ margin: 0, fontSize: 14 }}>{enderecoCompleto(e)}{e.complemento ? ` · ${e.complemento}` : ''}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <a className="wd-eq-botao-sec" style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} href={linkMapa(e)} target="_blank" rel="noopener"><MapPin size={16} />Mapa</a>
          {e.telefone && <a className="wd-eq-botao-sec" style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} href={`tel:+${String(e.telefone).replace(/\D/g, '').replace(/^(?!55)/, '55')}`}><Phone size={16} />Ligar</a>}
        </div>
        <div className="wd-eq-obs" style={{ background: e.pago ? '#e7f7ec' : '#fff8e6', color: e.pago ? '#166534' : '#6b4e00' }}>
          {e.pago ? 'Pago' : `Cobrar ${formatCurrency(Number(e.valor_total) || 0)}`}{formas(e.forma_pagamento) ? ` · ${formas(e.forma_pagamento)}` : ''}{!e.pago && e.troco_para ? ` · troco para ${formatCurrency(Number(e.troco_para))}` : ''}
        </div>
        {e.observacoes && <p className="wd-eq-obs">{e.observacoes}</p>}
        {e.status === 'pronto'
          ? <button type="button" className="wd-eq-botao" disabled={ocupado === e.id} onClick={() => executar('saiu', e)}>Saí para entrega</button>
          : <button type="button" className="wd-eq-botao" disabled={ocupado === e.id} onClick={() => executar('entregue', e)}>Entregue</button>}
      </article>)}</div>}

    {painel.modo === 'motoboys_escolhem' && painel.disponivel && <>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '18px 0 10px' }}>Entregas para pegar</h2>
      {painel.paraPegar.length === 0 ? <p className="wd-equipe-vazio" style={{ paddingTop: 12 }}>Nenhuma entrega pronta esperando</p> :
        <div className="wd-eq-grade">{painel.paraPegar.map(e => <article key={e.id} className="wd-eq-card">
          <div className="wd-eq-card-topo"><span className="wd-eq-codigo">{e.codigo ? `#${e.codigo}` : 'Entrega'}</span><span className="wd-eq-tag" data-tipo="delivery">{e.bairro || 'Entrega'}</span></div>
          <p style={{ margin: 0, fontSize: 14 }}>{enderecoCompleto(e)}</p>
          <button type="button" className="wd-eq-botao" disabled={ocupado === e.id} onClick={() => executar('pegar', e)}>Pegar entrega</button>
        </article>)}</div>}
    </>}
  </>
}
