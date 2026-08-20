'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeTenantId } from '@/lib/active-tenant-client'
import {
  Clock, MapPin, CreditCard, User, Save, Plus, X, Sparkles, Calendar, Upload, Trash2, Image as ImageIcon, Copy, Ban, CheckCircle2
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CoordinateMap } from '@/components/coordinate-map'

type Tab = 'horarios' | 'entregas' | 'perfil'

const DIAS_SEMANA = [
  { id: 'seg', nome: 'Segunda' },
  { id: 'ter', nome: 'Terça' },
  { id: 'qua', nome: 'Quarta' },
  { id: 'qui', nome: 'Quinta' },
  { id: 'sex', nome: 'Sexta' },
  { id: 'sab', nome: 'Sábado' },
  { id: 'dom', nome: 'Domingo' },
]

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>('horarios')
  const [tenant, setTenant] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    loadTenant()
    if (new URLSearchParams(window.location.search).get('tab') === 'perfil') setTab('perfil')
  }, [])

  const loadTenant = async () => {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const tid = await activeTenantId()
    if (!tid) return
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tid)
      .single()
    setTenant(data)
  }

  const tabs = [
    { id: 'horarios', label: 'Horários', icon: Clock },
    { id: 'entregas', label: 'Entregas', icon: MapPin },
    { id: 'perfil', label: 'Meu perfil', icon: User },
  ] as const

  return (
    <div>
      <div className="glass-iridescent px-7 py-7 mb-5 relative">
        <div className="relative z-10">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Sparkles size={11} />
            Empresa
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
            Configurações
          </h1>
          <p className="hint mt-2">Horários, entregas e perfil</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
        {tabs.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition whitespace-nowrap"
              style={
                active
                  ? { background: 'var(--green)', color: 'white', boxShadow: '0 0 24px -4px rgba(22,163,74,.5)' }
                  : { background: 'rgba(255,255,255,.7)', border: '1px solid var(--line)', color: 'var(--ink-muted)' }
              }
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'horarios' && <HorariosTab tenant={tenant} loadTenantFromParent={loadTenant} />}
      {tab === 'entregas' && <EntregasTab />}
      {tab === 'perfil' && <PerfilEditavel tenant={tenant} onSaved={loadTenant} />}
    </div>
  )
}

function HorariosTab({ tenant, loadTenantFromParent }: { tenant: any; loadTenantFromParent?: () => Promise<void> }) {
  const supabase = createClient()
  const config = (tenant?.config || {}) as any
  const [horarios, setHorarios] = useState<Record<string, { abre: string; fecha: string; ativo: boolean }>>(
    config.horarios_dias || {
      seg: { abre: '08:00', fecha: '22:00', ativo: true },
      ter: { abre: '08:00', fecha: '22:00', ativo: true },
      qua: { abre: '08:00', fecha: '22:00', ativo: true },
      qui: { abre: '08:00', fecha: '22:00', ativo: true },
      sex: { abre: '08:00', fecha: '22:00', ativo: true },
      sab: { abre: '08:00', fecha: '23:00', ativo: true },
      dom: { abre: '09:00', fecha: '21:00', ativo: false },
    }
  )
  const [excecoes, setExcecoes] = useState<{ data: string; abre: string; fecha: string; motivo?: string }[]>(
    config.excecoes_horario || []
  )
  const [novaExcecao, setNovaExcecao] = useState({ data: '', abre: '', fecha: '', motivo: '' })

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const toggleDia = (id: string) => {
    setHorarios({ ...horarios, [id]: { ...horarios[id], ativo: !horarios[id].ativo } })
  }

  const updateHorario = (id: string, campo: 'abre' | 'fecha', valor: string) => {
    setHorarios({ ...horarios, [id]: { ...horarios[id], [campo]: valor } })
  }

  const fecharDia = (id: string) => {
    setHorarios({
      ...horarios,
      [id]: { ...horarios[id], ativo: false, abre: '00:00', fecha: '00:00' },
    })
  }

  const reabrirDia = (id: string) => {
    setHorarios({
      ...horarios,
      [id]: { ...horarios[id], ativo: true, abre: '08:00', fecha: '22:00' },
    })
  }

  const replicarParaTodos = (idOrigem: string) => {
    const origem = horarios[idOrigem]
    if (!origem || !origem.ativo) {
      alert('Esse dia está fechado. Abra o dia antes de replicar o horário.')
      return
    }
    const confirmar = confirm(
      `Replicar o horário ${origem.abre} às ${origem.fecha} para todos os outros dias abertos?\n\nOs dias fechados não serão alterados.`
    )
    if (!confirmar) return
    const novo: typeof horarios = { ...horarios }
    DIAS_SEMANA.forEach((d) => {
      if (d.id !== idOrigem && novo[d.id].ativo) {
        novo[d.id] = { ...novo[d.id], abre: origem.abre, fecha: origem.fecha }
      }
    })
    setHorarios(novo)
  }

  const salvarHorarios = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Sessão expirada. Faça login novamente.')
      const tid = await activeTenantId()
      if (!tid) throw new Error('Loja ativa não encontrada.')

      const configAtual = (tenant?.config || {}) as any
      const novoConfig = {
        ...configAtual,
        horarios_dias: horarios,
        excecoes_horario: excecoes,
      }

      const { error } = await supabase
        .from('tenants')
        .update({ config: novoConfig })
        .eq('id', tid)

      if (error) throw error

      // Log de auditoria
      await fetch('/api/auditoria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        tenant_id: tid,
        user_id: user.user.id,
        acao: 'atualizar',
        tabela: 'tenants',
        registro_id: tid,
        dados_anteriores: configAtual,
        dados_novos: novoConfig,
      }) })

      setSaveMsg({ type: 'ok', text: 'Horários salvos com sucesso!' })
      // recarrega tenant pra refletir
      await loadTenantFromParent?.()
    } catch (e: any) {
      setSaveMsg({ type: 'error', text: e.message || 'Erro ao salvar' })
    } finally {
      setSaving(false)
    }
  }

  const addExcecao = () => {
    if (!novaExcecao.data || !novaExcecao.abre || !novaExcecao.fecha) return
    setExcecoes([...excecoes, novaExcecao])
    setNovaExcecao({ data: '', abre: '', fecha: '', motivo: '' })
  }

  const removeExcecao = (idx: number) => {
    setExcecoes(excecoes.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-5">
      <div className="glass p-6">
        <div className="eyebrow mb-1">Por dia da semana</div>
        <h2 className="text-lg font-semibold mb-5">Horários regulares</h2>
        <div className="space-y-2">
          {DIAS_SEMANA.map((d) => {
            const h = horarios[d.id]
            return (
              <div key={d.id} className="glass-soft p-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => toggleDia(d.id)}
                  className="size-9 rounded-xl flex items-center justify-center transition flex-shrink-0"
                  style={{
                    background: h.ativo ? 'var(--green)' : 'rgba(0,0,0,.06)',
                    color: h.ativo ? 'white' : 'var(--ink-muted)',
                  }}
                  title={h.ativo ? 'Desativar este dia' : 'Ativar este dia'}
                >
                  {h.ativo ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                </button>
                <div className="w-24 font-semibold flex-shrink-0" style={{ color: h.ativo ? 'var(--ink)' : 'var(--ink-faint)' }}>
                  {d.nome}
                </div>
                <div className="flex gap-2 items-center flex-1 min-w-[220px]">
                  <input
                    type="time"
                    value={h.abre}
                    onChange={(e) => updateHorario(d.id, 'abre', e.target.value)}
                    disabled={!h.ativo}
                    style={{ width: 'auto', maxWidth: 130, opacity: h.ativo ? 1 : 0.4 }}
                  />
                  <span className="hint">às</span>
                  <input
                    type="time"
                    value={h.fecha}
                    onChange={(e) => updateHorario(d.id, 'fecha', e.target.value)}
                    disabled={!h.ativo}
                    style={{ width: 'auto', maxWidth: 130, opacity: h.ativo ? 1 : 0.4 }}
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {h.ativo ? (
                    <>
                      <button
                        onClick={() => replicarParaTodos(d.id)}
                        className="btn-ghost text-xs"
                        title="Replicar este horário para todos os dias abertos"
                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}
                      >
                        <Copy size={12} />
                        Replicar p/ todos
                      </button>
                      <button
                        onClick={() => fecharDia(d.id)}
                        className="btn-ghost text-xs"
                        title="Marcar este dia como fechado (folga)"
                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem', color: '#B91C1C' }}
                      >
                        <Ban size={12} />
                        Fechar dia
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => reabrirDia(d.id)}
                      className="btn-ghost text-xs"
                      title="Reabrir este dia"
                      style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}
                    >
                      <CheckCircle2 size={12} />
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="glass p-6">
        <div className="eyebrow mb-1">Exceções</div>
        <h2 className="text-lg font-semibold mb-2">Datas especiais</h2>
        <p className="hint text-xs mb-4">Abra mais cedo ou feche mais tarde em datas específicas (feriados, eventos)</p>

        <div className="glass-soft p-4 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div>
              <label>Data</label>
              <input type="date" value={novaExcecao.data} onChange={(e) => setNovaExcecao({ ...novaExcecao, data: e.target.value })} />
            </div>
            <div>
              <label>Abre</label>
              <input type="time" value={novaExcecao.abre} onChange={(e) => setNovaExcecao({ ...novaExcecao, abre: e.target.value })} />
            </div>
            <div>
              <label>Fecha</label>
              <input type="time" value={novaExcecao.fecha} onChange={(e) => setNovaExcecao({ ...novaExcecao, fecha: e.target.value })} />
            </div>
            <button onClick={addExcecao} className="btn-primary justify-center"><Plus size={14} />Adicionar</button>
          </div>
          <div className="mt-2">
            <label>Motivo (opcional)</label>
            <input value={novaExcecao.motivo} onChange={(e) => setNovaExcecao({ ...novaExcecao, motivo: e.target.value })} placeholder="Ex: Feriado, Evento especial..." />
          </div>
        </div>

        <div className="space-y-2">
          {excecoes.map((ex, idx) => (
            <div key={idx} className="glass-soft p-3 flex items-center gap-3">
              <Calendar size={16} style={{ color: 'var(--green)' }} />
              <div className="font-mono text-sm font-semibold">{new Date(ex.data).toLocaleDateString('pt-BR')}</div>
              <div className="hint">{ex.abre} - {ex.fecha}</div>
              {ex.motivo && <div className="hint text-xs flex-1 truncate">• {ex.motivo}</div>}
              <button onClick={() => removeExcecao(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
                <X size={14} />
              </button>
            </div>
          ))}
          {excecoes.length === 0 && (
            <div className="text-center py-6 hint text-sm">Nenhuma exceção cadastrada</div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {saveMsg && (
          <div
            className="text-sm text-center p-3 rounded-2xl"
            style={{
              background: saveMsg.type === 'ok' ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.10)',
              color: saveMsg.type === 'ok' ? '#15803D' : '#B91C1C',
            }}
          >
            {saveMsg.text}
          </div>
        )}
        <button onClick={salvarHorarios} disabled={saving} className="btn-primary w-full justify-center">
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar horários'}
        </button>
      </div>
    </div>
  )
}

function EntregasTab() {
  const empty = { id: '', bairro: '', taxa: 0, prazo_min: '', ativo: true }
  const [data,setData]=useState<any>({bairros:[],config:{valor_km:2,minimo:5,max_km:20,arredondamento:'ceil'},origem:{}})
  const [form,setForm]=useState<any>(empty); const [metodo,setMetodo]=useState<'bairro'|'km'>('bairro'); const [query,setQuery]=useState(''); const [suggestions,setSuggestions]=useState<any[]>([]); const [mapOk,setMapOk]=useState<boolean|null>(null); const [preview,setPreview]=useState<any>(null); const [msg,setMsg]=useState('')
  const [venderSemEstoque,setVenderSemEstoque]=useState(false)
  const [salvandoEstoque,setSalvandoEstoque]=useState(false)
  const load=async()=>{const r=await fetch('/api/configuracoes/entregas',{cache:'no-store'});const b=await r.json();if(r.ok){setData(b);setMetodo(b.config?.metodo||'bairro');setQuery(b.origem?.endereco||'');setVenderSemEstoque(b.config?.entrega_km?.vender_sem_estoque===true)}}
  useEffect(()=>{load();fetch('/api/mapbox',{cache:'no-store'}).then(r=>r.json()).then(b=>setMapOk(Boolean(b.configured))).catch(()=>setMapOk(false))},[])
  useEffect(()=>{if(query.length<3)return setSuggestions([]);const timer=setTimeout(async()=>{const r=await fetch('/api/mapbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',query})});const b=await r.json();setMapOk(b.configured);setSuggestions(b.suggestions||[])},350);return()=>clearTimeout(timer)},[query])
  const saveBairro=async()=>{const r=await fetch('/api/configuracoes/entregas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const b=await r.json();setMsg(r.ok?'Bairro salvo.':b.error);if(r.ok){setForm(empty);load()}}
  const remove=async(id:string)=>{if(!confirm('Excluir este bairro?'))return;await fetch(`/api/configuracoes/entregas?id=${id}`,{method:'DELETE'});load()}
  const selectPlace=(place:any)=>{setData((d:any)=>({...d,origem:{endereco:place.label,latitude:place.latitude,longitude:place.longitude}}));setQuery(place.label);setSuggestions([])}
  const saveKm=async()=>{if(metodo==='km'&&mapOk!==true)return setMsg('Entrega por km indisponível sem MAPBOX_ACCESS_TOKEN. Use o método por bairro.');const config={...data.config,metodo};const r=await fetch('/api/configuracoes/entregas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'km',metodo,config,origem:{...data.origem,endereco:query}})});setMsg(r.ok?'Configuração salva.':(await r.json()).error)}
  const calcPreview=async()=>{if(!preview?.longitude||!data.origem?.longitude)return;const r=await fetch('/api/mapbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'route',origem:data.origem,destino:preview})});const b=await r.json();if(r.ok){const raw=Math.max(Number(data.config.minimo)||0,b.km*Number(data.config.valor_km||0));const taxa=data.config.arredondamento==='ceil'?Math.ceil(raw):data.config.arredondamento==='round'?Math.round(raw):raw;setPreview({...preview,...b,taxa})}else setMsg(b.error)}
  const salvarVenderSemEstoque=async()=>{setSalvandoEstoque(true);const config={...data.config,entrega_km:{...data.config?.entrega_km,vender_sem_estoque:venderSemEstoque}};const r=await fetch('/api/configuracoes/entregas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'config',config})});const b=await r.json();setMsg(r.ok?'Configuração de estoque salva.':b.error);setSalvandoEstoque(false)}
  return <div className="space-y-5">
    <div className="glass p-6"><h2 className="text-lg font-semibold mb-4">Método da taxa</h2><div className="grid grid-cols-2 gap-3">{(['bairro','km'] as const).map(v=><button key={v} disabled={v==='km'&&mapOk===false} onClick={()=>{if(v==='km'&&mapOk!==true){setMsg('Entrega por km indisponível. Configure o Mapbox ou mantenha bairro.');return}setMetodo(v)}} className="p-4 rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed" style={{borderColor:metodo===v?'var(--green)':'var(--line)'}}>{v==='bairro'?'Por bairro':'Por quilômetro'}</button>)}</div></div>
    <div className="glass p-6"><h2 className="text-lg font-semibold mb-4">Controle de estoque</h2><div className="flex items-start gap-4"><label className="flex items-start gap-3 cursor-pointer flex-1"><input type="checkbox" checked={venderSemEstoque} onChange={e=>setVenderSemEstoque(e.target.checked)} className="mt-1 size-4 rounded border-gray-300 text-green-600"/><div><p className="font-medium">Vender mesmo sem estoque</p><p className="text-sm text-gray-500 mt-1">Quando ativado, os pedidos são finalizados mesmo que o estoque de matéria-prima, complementos ou produtos esteja zerado ou negativo. Ideal para quem prepara sob demanda.</p></div></label><button className="btn-primary shrink-0" onClick={salvarVenderSemEstoque} disabled={salvandoEstoque}>{salvandoEstoque?'Salvando...':'Salvar'}</button></div></div>
    {metodo==='bairro'?<><div className="glass p-6"><h2 className="text-lg font-semibold mb-4">{form.id?'Editar':'Novo'} bairro</h2><div className="grid md:grid-cols-5 gap-3"><input placeholder="Bairro" value={form.bairro} onChange={e=>setForm({...form,bairro:e.target.value})}/><input type="number" step=".01" placeholder="Taxa" value={form.taxa} onChange={e=>setForm({...form,taxa:Number(e.target.value)})}/><input type="number" placeholder="Prazo (min)" value={form.prazo_min} onChange={e=>setForm({...form,prazo_min:e.target.value})}/><label className="flex items-center gap-2"><input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})}/>Ativo</label><button className="btn-primary justify-center" onClick={saveBairro}><Save size={14}/>Salvar</button></div></div><div className="glass p-6 space-y-2">{data.bairros.map((b:any)=><div key={b.id} className="glass-soft p-3 flex items-center gap-3"><MapPin size={15}/><b className="flex-1">{b.bairro}</b><span>{formatCurrency(Number(b.taxa))}{b.prazo_min?` · ${b.prazo_min} min`:''}</span><span className={b.ativo?'text-green-700':'text-gray-400'}>{b.ativo?'Ativo':'Inativo'}</span><button onClick={()=>setForm({...b,prazo_min:b.prazo_min||''})}>Editar</button><button className="text-red-600" onClick={()=>remove(b.id)}>Excluir</button></div>)}</div></>:<div className="glass p-6 space-y-4"><h2 className="text-lg font-semibold">Taxa por distância real</h2><div className="relative"><label>Origem da loja</label><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busque o endereço de origem"/><div className="absolute z-20 bg-white shadow rounded-xl w-full">{suggestions.map(s=><button className="block w-full text-left p-2" key={s.id} onClick={()=>selectPlace(s)}>{s.label}</button>)}</div></div>{mapOk===false&&<div className="p-3 bg-amber-50 text-amber-800 rounded-xl">Mapa indisponível: configure MAPBOX_ACCESS_TOKEN no servidor. Bairro continua funcionando.</div>}<CoordinateMap value={data.origem} onChange={(p:any)=>setData((d:any)=>({...d,origem:{...d.origem,...p}}))}/><div className="grid md:grid-cols-4 gap-3"><FieldNum label="R$/km" value={data.config.valor_km} onChange={(v:number)=>setData((d:any)=>({...d,config:{...d.config,valor_km:v}}))}/><FieldNum label="Taxa mínima" value={data.config.minimo} onChange={(v:number)=>setData((d:any)=>({...d,config:{...d.config,minimo:v}}))}/><FieldNum label="Raio máximo (km)" value={data.config.max_km} onChange={(v:number)=>setData((d:any)=>({...d,config:{...d.config,max_km:v}}))}/><label>Arredondamento<select value={data.config.arredondamento} onChange={e=>setData((d:any)=>({...d,config:{...d.config,arredondamento:e.target.value}}))}><option value="ceil">Para cima</option><option value="round">Mais próximo</option><option value="none">Centavos</option></select></label></div><button className="btn-primary" onClick={saveKm}>Salvar taxa por km</button><div className="border-t pt-4"><h3 className="font-semibold">Prévia de rota</h3><input className="mt-2" placeholder="Longitude destino" onChange={e=>setPreview({...preview,longitude:Number(e.target.value)})}/><input className="mt-2" placeholder="Latitude destino" onChange={e=>setPreview({...preview,latitude:Number(e.target.value)})}/><button className="btn-ghost mt-2" onClick={calcPreview}>Calcular rota</button>{preview?.km&&<p className="mt-2"><b>{preview.km.toFixed(2)} km</b> · {preview.minutos} min · taxa {formatCurrency(preview.taxa)}</p>}</div></div>}{msg&&<p className="text-sm text-center">{msg}</p>}
  </div>
}

function FieldNum({label,value,onChange}:{label:string,value:any,onChange:(v:number)=>void}){return <label>{label}<input type="number" step=".01" value={value??''} onChange={e=>onChange(Number(e.target.value))}/></label>}
function PagamentosTab({ tenant }: { tenant: any }) {
  const supabase = createClient()
  const config = (tenant?.config || {}) as any
  const [pagamentos, setPagamentos] = useState(config.formas_pagamento_aceitas || {
    dinheiro: true,
    pix: true,
    credito: false,
    debito: false,
  })
  const [trocoMax, setTrocoMax] = useState(config.troco_maximo || 100)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const formas = [
    { id: 'dinheiro', nome: 'Dinheiro', desc: 'Pagamento em espécie na entrega', emoji: '💵' },
    { id: 'pix', nome: 'PIX', desc: 'Transferência instantânea', emoji: '🔑' },
    { id: 'credito', nome: 'Cartão de Crédito', desc: 'Máquina na entrega', emoji: '💳' },
    { id: 'debito', nome: 'Cartão de Débito', desc: 'Máquina na entrega', emoji: '💳' },
  ]

  const salvar = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')
      const tid = await activeTenantId()
      if (!tid) throw new Error('Loja ativa não encontrada.')

      const configAtual = (tenant?.config || {}) as any
      const novoConfig = {
        ...configAtual,
        formas_pagamento_aceitas: pagamentos,
        troco_maximo: trocoMax,
      }

      const { error } = await supabase
        .from('tenants')
        .update({ config: novoConfig })
        .eq('id', tid)
      if (error) throw error

      // Auditoria
      await fetch('/api/auditoria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        tenant_id: tid,
        user_id: user.id,
        acao: 'atualizar',
        tabela: 'tenants',
        registro_id: tid,
        dados_anteriores: { formas_pagamento_aceitas: configAtual.formas_pagamento_aceitas, troco_maximo: configAtual.troco_maximo },
        dados_novos: { formas_pagamento_aceitas: pagamentos, troco_maximo: trocoMax },
      }) })

      setSaveMsg({ type: 'ok', text: 'Formas de pagamento salvas com sucesso!' })
    } catch (e: any) {
      setSaveMsg({ type: 'error', text: e.message || 'Erro ao salvar' })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 5000)
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass p-6">
        <div className="eyebrow mb-1">Aceitar</div>
        <h2 className="text-lg font-semibold mb-5">Formas de pagamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formas.map((f) => {
            const ativo = pagamentos[f.id]
            return (
              <button
                key={f.id}
                onClick={() => setPagamentos({ ...pagamentos, [f.id]: !ativo })}
                className="text-left p-4 rounded-2xl flex items-center gap-3 transition"
                style={
                  ativo
                    ? { background: 'rgba(22,163,74,.08)', border: '2px solid rgba(22,163,74,.4)' }
                    : { background: 'rgba(255,255,255,.5)', border: '1px solid var(--line)' }
                }
              >
                <div className="size-10 rounded-xl flex items-center justify-center text-2xl" style={{
                  background: ativo ? 'rgba(22,163,74,.14)' : 'rgba(0,0,0,.04)',
                }}>
                  {f.emoji}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{f.nome}</div>
                  <div className="hint text-xs">{f.desc}</div>
                </div>
                <div className="size-5 rounded-md flex items-center justify-center" style={{
                  background: ativo ? 'var(--green)' : 'rgba(0,0,0,.06)',
                  color: 'white',
                }}>
                  {ativo ? '✓' : ''}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {pagamentos.dinheiro && (
        <div className="glass p-6">
          <div className="eyebrow mb-1">Troco</div>
          <h2 className="text-lg font-semibold mb-3">Troco máximo disponível</h2>
          <p className="hint mb-4">Valor máximo que sua loja consegue dar de troco</p>
          <div className="flex gap-2 items-center">
            <span className="hint">R$</span>
            <input
              type="number"
              value={trocoMax}
              onChange={(e) => setTrocoMax(parseFloat(e.target.value) || 0)}
              style={{ width: 150 }}
              step="0.01"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {saveMsg && (
          <div
            className="text-sm text-center p-3 rounded-2xl"
            style={{
              background: saveMsg.type === 'ok' ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.10)',
              color: saveMsg.type === 'ok' ? '#15803D' : '#B91C1C',
            }}
          >
            {saveMsg.text}
          </div>
        )}
        <button onClick={salvar} disabled={saving} className="btn-primary w-full justify-center">
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar formas de pagamento'}
        </button>
      </div>
    </div>
  )
}

function PerfilEditavel({tenant,onSaved}:{tenant:any;onSaved:()=>Promise<void>}) {
  const [form,setForm]=useState<any>(tenant||{}); const [status,setStatus]=useState<any>(null); const [saving,setSaving]=useState(false); const [uploading,setUploading]=useState(false)
  useEffect(()=>setForm(tenant||{}),[tenant])
  useEffect(()=>{if(!form.slug)return;const timer=setTimeout(async()=>{const r=await fetch(`/api/perfil-loja?slug=${encodeURIComponent(form.slug)}`);setStatus(await r.json())},350);return()=>clearTimeout(timer)},[form.slug])
  const change=(key:string,value:any)=>setForm((f:any)=>({...f,[key]:value}))
  const upload=async(file:File)=>{setUploading(true);const fd=new FormData();fd.append('file',file);const r=await fetch('/api/upload-logo',{method:'POST',body:fd});const b=await r.json();setUploading(false);if(r.ok)change('logo_url',b.url);else alert(b.error)}
  const save=async()=>{setSaving(true);const r=await fetch('/api/perfil-loja',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const b=await r.json();setSaving(false);if(!r.ok)return alert(b.error);change('slug',b.slug);await onSaved();alert('Perfil atualizado.')}
  const fields=[['nome','Nome do negócio'],['cpf','CPF do responsável'],['cnpj','CNPJ'],['categoria','Categoria'],['telefone','WhatsApp'],['endereco','Endereço'],['numero','Número'],['cidade','Cidade'],['estado','UF']]
  return <div className="space-y-5"><div className="glass p-6"><h2 className="text-lg font-semibold mb-4">Logo da loja</h2><div className="flex items-center gap-4">{form.logo_url?<img src={form.logo_url} className="size-24 rounded-2xl object-contain bg-white" alt="Logo"/>:<div className="size-24 rounded-2xl bg-gray-100 grid place-items-center"><ImageIcon/></div>}<label className="btn-ghost cursor-pointer"><Upload size={15}/>{uploading?'Enviando...':'Alterar logo'}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={e=>{const f=e.target.files?.[0];if(f)upload(f)}}/></label></div></div><div className="glass p-6"><h2 className="text-lg font-semibold mb-4">Dados do estabelecimento</h2><div className="grid md:grid-cols-2 gap-4">{fields.map(([key,label])=><label key={key}>{label}<input value={form[key]||''} onChange={e=>change(key,e.target.value)}/></label>)}<label className="md:col-span-2">Slug público<div className="flex gap-2"><span className="py-3 text-sm">wedelivery.site/cardapio/</span><input value={form.slug||''} onChange={e=>change('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-'))}/></div>{status&&<p className={`text-xs mt-1 ${status.available?'text-green-700':'text-red-600'}`}>{status.available?'Disponível':'Indisponível'}{!status.available&&status.suggestions?.length?` · Sugestões: ${status.suggestions.join(', ')}`:''}</p>}</label></div><button className="btn-primary mt-5" disabled={saving||status?.available===false} onClick={save}><Save size={15}/>{saving?'Salvando...':'Salvar perfil'}</button></div></div>
}
