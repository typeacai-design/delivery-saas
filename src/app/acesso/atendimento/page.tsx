'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LogOut,
  Loader2,
  Plus,
  Search,
  X,
  Home,
  Users,
  ShoppingBag,
  Bell,
  ChevronLeft,
  Bike,
  ShoppingBasket,
  MapPin,
  Phone,
  Clock,
} from 'lucide-react'

interface Membro {
  id: string
  nome: string
  perfil: string
  tenant_id: string
}

type TipoPedido = 'delivery' | 'mesa' | 'retirada'

export default function AtendimentoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [membro, setMembro] = useState<Membro | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'inicio' | 'pedidos' | 'clientes' | 'config'>('inicio')
  const [modalTipoAberto, setModalTipoAberto] = useState(false)
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoPedido | null>(null)
  const [mesaSelecionada, setMesaSelecionada] = useState<number | null>(null)
  const [clienteSearch, setClienteSearch] = useState('')
  const [stats, setStats] = useState({ novo: 0, preparando: 0, pronto: 0 })
  const [mesas] = useState<{ numero: number; ativa: boolean; emPreparo: boolean }[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({
      numero: i + 1,
      ativa: [3, 5, 12].includes(i + 1),
      emPreparo: [7].includes(i + 1),
    }))
  )

  useEffect(() => {
    const supabase = createClient()
    const raw = typeof window !== 'undefined' ? localStorage.getItem('membro_equipe') : null
    if (!raw) {
      router.push('/acesso')
      return
    }
    try {
      const m: Membro = JSON.parse(raw)
      if (m.perfil !== 'atendimento') {
        router.push(m.perfil === 'cozinha' ? '/acesso/cozinha' : m.perfil === 'motoboy' ? '/acesso/motoboy' : '/acesso')
        return
      }
      setMembro(m)
      carregarStats(m.tenant_id, supabase)
    } catch {
      router.push('/acesso')
    } finally {
      setLoading(false)
    }
  }, [router])

  async function carregarStats(tenantId: string, supabase: any) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('pedidos')
      .select('status')
      .eq('tenant_id', tenantId)
      .gte('created_at', hoje.toISOString())
    const lista: any[] = data || []
    setStats({
      novo: lista.filter((p) => ['pendente', 'recebido'].includes(p.status)).length,
      preparando: lista.filter((p) => p.status === 'preparando').length,
      pronto: lista.filter((p) => p.status === 'pronto').length,
    })
  }

  function logout() {
    localStorage.removeItem('membro_equipe')
    router.push('/acesso')
  }

  function abrirNovoPedido() {
    setTipoSelecionado(null)
    setMesaSelecionada(null)
    setClienteSearch('')
    setModalTipoAberto(true)
  }

  function escolherTipo(tipo: TipoPedido) {
    setTipoSelecionado(tipo)
    if (tipo === 'mesa') {
      // continuar no modal para escolher mesa
    } else {
      setModalTipoAberto(false)
    }
  }

  function confirmarMesa(numero: number) {
    setMesaSelecionada(numero)
    setModalTipoAberto(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-gray-100 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
            <HeadphonesIcon />
          </div>
          <div>
            <div className="text-base font-bold text-gray-900">Atendimento</div>
            <div className="text-xs text-gray-500">{membro?.nome}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
          aria-label="Sair"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="px-4 py-4 space-y-5">
        {/* CTA Novo Pedido */}
        <button
          onClick={abrirNovoPedido}
          className="w-full bg-gradient-to-br from-green-600 via-green-500 to-emerald-400 text-white rounded-2xl p-6 text-center shadow-lg shadow-green-500/40 active:scale-[0.98] transition-transform"
        >
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
            <Plus size={28} className="text-white" />
          </div>
          <div className="text-xl font-bold">Novo pedido</div>
          <div className="text-sm opacity-90 mt-1">Iniciar atendimento a um cliente</div>
        </button>

        {/* Stats Hoje */}
        <section>
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={16} /> Resumo de hoje
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            <StatChip label="Novos" value={stats.novo} variant="novo" />
            <StatChip label="Preparando" value={stats.preparando} variant="preparando" />
            <StatChip label="Prontos" value={stats.pronto} variant="pronto" />
          </div>
        </section>

        {/* Mesas */}
        <section>
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Mesas</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {mesas.map((m) => {
              const cls = m.emPreparo
                ? 'bg-amber-50 border-amber-400'
                : m.ativa
                  ? 'bg-green-50 border-green-500'
                  : 'bg-white border-gray-200'
              const status = m.emPreparo ? 'em preparo' : m.ativa ? 'ocupada' : 'livre'
              const statusColor = m.emPreparo ? 'text-amber-700' : m.ativa ? 'text-green-700' : 'text-gray-400'
              return (
                <button
                  key={m.numero}
                  className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center active:scale-95 transition-transform ${cls}`}
                >
                  <div className="text-xl font-bold text-gray-900">{m.numero}</div>
                  <div className={`text-[10px] font-semibold mt-1 uppercase ${statusColor}`}>{status}</div>
                </button>
              )
            })}
          </div>
        </section>
      </main>

      {/* Modal seleção de tipo */}
      {modalTipoAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-[390px] rounded-t-2xl p-5 pb-8 animate-[slideUp_0.3s_ease]">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {!tipoSelecionado && (
              <>
                <h3 className="text-xl font-bold text-center mb-5">Como será o pedido?</h3>
                <div className="flex flex-col gap-3">
                  <TipoModalCard
                    tipo="delivery"
                    cor="blue"
                    icone={<Bike size={24} />}
                    titulo="Delivery"
                    subtitulo="Entrega no endereço do cliente"
                    onClick={() => escolherTipo('delivery')}
                  />
                  <TipoModalCard
                    tipo="mesa"
                    cor="orange"
                    icone={<MapPin size={24} />}
                    titulo="Mesa"
                    subtitulo="Consumo no local"
                    onClick={() => escolherTipo('mesa')}
                  />
                  <TipoModalCard
                    tipo="retirada"
                    cor="purple"
                    icone={<ShoppingBasket size={24} />}
                    titulo="Retirada"
                    subtitulo="Cliente busca no balcão"
                    onClick={() => escolherTipo('retirada')}
                  />
                </div>
                <button
                  onClick={() => setModalTipoAberto(false)}
                  className="w-full mt-3 py-3.5 bg-gray-100 text-gray-600 rounded-full font-semibold text-sm"
                >
                  Cancelar
                </button>
              </>
            )}

            {tipoSelecionado === 'mesa' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setTipoSelecionado(null)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h3 className="text-xl font-bold">Escolha a mesa</h3>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {mesas.filter((m) => !m.ativa && !m.emPreparo).map((m) => (
                    <button
                      key={m.numero}
                      onClick={() => confirmarMesa(m.numero)}
                      className="aspect-square bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center active:scale-95"
                    >
                      <span className="text-2xl font-bold">{m.numero}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setModalTipoAberto(false)}
                  className="w-full mt-5 py-3.5 bg-gray-100 text-gray-600 rounded-full font-semibold text-sm"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/85 backdrop-blur-xl border-t border-gray-200 max-w-[390px] mx-auto flex justify-around py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        <NavItem icone={<Home size={22} />} label="Início" ativo={abaAtiva === 'inicio'} onClick={() => setAbaAtiva('inicio')} />
        <NavItem icone={<ShoppingBag size={22} />} label="Pedidos" ativo={abaAtiva === 'pedidos'} onClick={() => setAbaAtiva('pedidos')} />
        <NavItem icone={<Users size={22} />} label="Clientes" ativo={abaAtiva === 'clientes'} onClick={() => setAbaAtiva('clientes')} />
        <NavItem icone={<Bell size={22} />} label="Avisos" ativo={abaAtiva === 'config'} onClick={() => setAbaAtiva('config')} />
      </nav>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function HeadphonesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-6a9 9 0 0 1 18 0v6a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

function StatChip({ label, value, variant }: { label: string; value: number; variant: 'novo' | 'preparando' | 'pronto' }) {
  const bg =
    variant === 'novo' ? 'bg-green-50' : variant === 'preparando' ? 'bg-amber-50' : 'bg-emerald-50'
  const num =
    variant === 'novo' ? 'text-green-700' : variant === 'preparando' ? 'text-amber-700' : 'text-emerald-600'
  return (
    <div className={`rounded-xl py-3 px-2 text-center ${bg}`}>
      <div className={`text-2xl font-bold ${num}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function TipoModalCard({
  tipo,
  cor,
  icone,
  titulo,
  subtitulo,
  onClick,
}: {
  tipo: TipoPedido
  cor: 'blue' | 'orange' | 'purple'
  icone: React.ReactNode
  titulo: string
  subtitulo: string
  onClick: () => void
}) {
  const map = {
    blue: { border: 'border-blue-500', bg: 'bg-blue-50', icon: 'bg-blue-500' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-50', icon: 'bg-orange-500' },
    purple: { border: 'border-purple-500', bg: 'bg-purple-50', icon: 'bg-purple-500' },
  }
  const c = map[cor]
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-xl border-2 ${c.border} ${c.bg} active:scale-[0.98] transition-transform`}
    >
      <div className={`w-12 h-12 rounded-full ${c.icon} flex items-center justify-center text-white flex-shrink-0`}>
        {icone}
      </div>
      <div className="flex-1 text-left">
        <h4 className="text-base font-bold">{titulo}</h4>
        <p className="text-[13px] text-gray-600">{subtitulo}</p>
      </div>
    </button>
  )
}

function NavItem({
  icone,
  label,
  ativo,
  onClick,
}: {
  icone: React.ReactNode
  label: string
  ativo: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg ${ativo ? 'text-green-600' : 'text-gray-500'}`}
    >
      {icone}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  )
}
