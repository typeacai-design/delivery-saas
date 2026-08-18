import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { formatCurrency } from '@/lib/utils'
import { Store, TrendingUp, DollarSign, ShoppingBag, AlertTriangle, Check, Plus, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

// Server Component do dashboard admin.
// Usa service_role porque admin não tem usuário no Supabase Auth (auth separado via cookie HttpOnly).
// Service_role ignora RLS e pode ler tudo.
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function AdminDashboard() {
  if (!(await getAdminSession())) redirect('/painel-admin/login')
  const supabase = getAdminClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, nome, slug, created_at, valor_mensalidade, status_pagamento, cidade')
    .order('created_at', { ascending: false })

  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

  const { data: pedidosRecentes } = await supabase
    .from('pedidos')
    .select('tenant_id, valor_total, data_criacao, status')
    .gte('data_criacao', trintaDiasAtras.toISOString())

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const { data: pedidosMes } = await supabase
    .from('pedidos')
    .select('tenant_id, valor_total')
    .gte('data_criacao', inicioMes.toISOString())

  const totalLojistas = tenants?.length || 0
  const lojistasComVendas = new Set(pedidosRecentes?.map(p => p.tenant_id) || [])
  const lojistasAtivos = lojistasComVendas.size
  const faturamentoMes = pedidosMes?.reduce((acc, p) => acc + Number(p.valor_total), 0) || 0
  const vendas30dias = pedidosRecentes?.reduce((acc, p) => acc + Number(p.valor_total), 0) || 0
  const inadimplentes = tenants?.filter(t => t.status_pagamento !== 'pago').length || 0
  const emDias = totalLojistas - inadimplentes

  const lojistasComMetricas = (tenants || []).map(tenant => {
    const vendasDoLojistaMes = pedidosMes?.filter(p => p.tenant_id === tenant.id) || []
    const totalVendido = vendasDoLojistaMes.reduce((acc, p) => acc + Number(p.valor_total), 0)
    return {
      ...tenant,
      vendasMes: totalVendido,
      pedidosMes: vendasDoLojistaMes.length,
      statusPagamento: tenant.status_pagamento || 'pendente',
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Store size={11} />
            Dashboard
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
            Visão Geral
          </h1>
          <p className="hint mt-1">Acompanhe seus lojistas</p>
        </div>
        <Link href="/painel-admin/lojistas?novo=1" className="btn-primary">
          <Plus size={14} />
          Novo Lojista
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Store} label="Lojistas" value={totalLojistas} color="green" />
        <StatCard icon={TrendingUp} label="Ativos (30d)" value={lojistasAtivos} color="white" />
        <StatCard icon={DollarSign} label="Faturamento mês" value={formatCurrency(faturamentoMes)} color="green" isCurrency />
        <StatCard icon={ShoppingBag} label="Vendas 30d" value={formatCurrency(vendas30dias)} color="green" isCurrency />
        <StatCard icon={Check} label="Em dia" value={emDias} color="white" />
        <StatCard icon={AlertTriangle} label="Inadimplentes" value={inadimplentes} color="red" />
      </div>

      {/* Tabela de Lojistas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Lojistas</h2>
          <Link href="/painel-admin/lojistas" className="btn-ghost text-sm flex items-center gap-1">
            Ver todos
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {lojistasComMetricas.length === 0 ? (
          <div className="glass-soft p-12 text-center rounded-2xl">
            <Store className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--ink-muted)' }} />
            <p className="hint font-medium">Nenhum lojista cadastrado</p>
            <Link href="/painel-admin/lojistas?novo=1" className="btn-primary mt-4 inline-flex">
              <Plus size={14} />
              Cadastrar primeiro lojista
            </Link>
          </div>
        ) : (
          <div className="glass-soft rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--line)' }}>
                  <th className="text-left py-3 px-4 text-xs font-medium hint">Lojista</th>
                  <th className="text-left py-3 px-4 text-xs font-medium hint">Cidade</th>
                  <th className="text-right py-3 px-4 text-xs font-medium hint">Vendas mês</th>
                  <th className="text-right py-3 px-4 text-xs font-medium hint">Pedidos</th>
                  <th className="text-right py-3 px-4 text-xs font-medium hint">Mensalidade</th>
                  <th className="text-center py-3 px-4 text-xs font-medium hint">Status</th>
                </tr>
              </thead>
              <tbody>
                {lojistasComMetricas.slice(0, 10).map((tenant) => (
                  <tr key={tenant.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: 'var(--line)' }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl flex items-center justify-center font-bold text-white" style={{ background: 'var(--green)' }}>
                          {tenant.nome?.[0]?.toUpperCase() || 'L'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tenant.nome}</p>
                          <p className="hint text-xs">{tenant.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hint text-sm">{tenant.cidade || '-'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-sm gradient-text">
                      {formatCurrency(tenant.vendasMes)}
                    </td>
                    <td className="py-3 px-4 text-right hint text-sm">{tenant.pedidosMes}</td>
                    <td className="py-3 px-4 text-right hint text-sm">
                      {formatCurrency(Number(tenant.valor_mensalidade) || 99.90)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`chip ${tenant.statusPagamento === 'pago' ? 'chip--positive' : 'chip--negative'}`}>
                        {tenant.statusPagamento === 'pago' ? 'Em dia' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, isCurrency }: {
  icon: any
  label: string
  value: string | number
  color: 'green' | 'white' | 'red'
  isCurrency?: boolean
}) {
  const colorMap = {
    green: 'rgba(22,163,74,.12)',
    white: 'rgba(0,0,0,.06)',
    red: 'rgba(220,38,38,.12)',
  }
  const iconMap = {
    green: '#15803D',
    white: 'var(--ink)',
    red: '#DC2626',
  }
  const textMap = {
    green: 'gradient-text',
    white: '',
    red: 'text-red-500',
  }

  return (
    <div className="glass-soft p-4 rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: colorMap[color] }}>
          <Icon size={14} style={{ color: iconMap[color] }} />
        </div>
      </div>
      <p className={`text-xl font-bold ${textMap[color]}`}>{value}</p>
      <p className="hint text-xs mt-0.5">{label}</p>
    </div>
  )
}
