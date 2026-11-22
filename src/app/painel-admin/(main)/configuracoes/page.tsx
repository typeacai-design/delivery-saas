'use client'

import { useEffect, useState } from 'react'
import { Settings, DollarSign, FileText, Shield, Save, Check, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import CheckoutMercadoPago from '@/components/admin/checkout-mercado-pago'
import { adminFetch } from '@/lib/admin-fetch'
import { useRouter, useSearchParams } from 'next/navigation'

const DEFAULTS = {
  nomeAdmin: 'Rick Machado',
  emailAdmin: '',
  senhaAtual: '',
  novaSenha: '',
  confirmarSenha: '',
  termosUso: '',
  politicaPrivacidade: '',
}

function abaValida(tab: string | null) {
  return tab === 'financeiro' || tab === 'admin' || tab === 'legais' ? tab : 'geral'
}

export default function ConfiguracoesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(() => abaValida(searchParams.get('tab')))
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [config, setConfig] = useState<typeof DEFAULTS>(DEFAULTS)
  const [authenticatedAdminEmail, setAuthenticatedAdminEmail] = useState('')

  useEffect(() => {
    adminFetch('/api/admin/me').then(async response => {
      if (!response.ok) throw new Error('Falha ao carregar identidade administrativa')
      const data = await response.json()
      setAuthenticatedAdminEmail(data.email || '')
    }).catch(error => setFeedback({ type: 'error', text: error.message }))

    adminFetch('/api/admin/config')
      .then(async (r) => {
        if (!r.ok) throw new Error('Falha ao carregar config')
        const data = await r.json()
        if (data.valor) {
          setConfig((c) => ({ ...c, ...data.valor, senhaAtual: '', novaSenha: '', confirmarSenha: '' }))
        }
      })
      .catch((e) => setFeedback({ type: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setActiveTab(abaValida(searchParams.get('tab')))
  }, [searchParams])

  const selectTab = (tab: string) => {
    setActiveTab(tab)
    router.replace('/painel-admin/configuracoes?tab=' + encodeURIComponent(tab), { scroll: false })
  }

  const tabs = [
    { id: 'geral', label: 'Geral', icon: Settings },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'admin', label: 'Perfil e segurança', icon: Shield },
    { id: 'legais', label: 'Legais', icon: FileText },
  ]

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      if (activeTab === 'admin' && (!config.senhaAtual || !config.novaSenha || !config.confirmarSenha)) {
        throw new Error('Preencha a senha atual, a nova senha e a confirmação')
      }
      if (config.novaSenha && config.novaSenha.length < 8) {
        throw new Error('A nova senha deve ter pelo menos 8 caracteres')
      }
      if (config.novaSenha && config.novaSenha !== config.confirmarSenha) {
        throw new Error('Nova senha e confirmação não conferem')
      }
      const { senhaAtual, novaSenha, confirmarSenha, ...resto } = config
      if (activeTab === 'admin') {
        if (novaSenha !== confirmarSenha) {
          throw new Error('Nova senha e confirmação não conferem')
        }
        if (!senhaAtual) {
          throw new Error('Informe a senha atual para trocar')
        }
        const r2 = await adminFetch('/api/admin/senha', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senhaAtual, novaSenha }),
        })
        const d2 = await r2.json()
        if (!r2.ok) throw new Error(d2.error || 'Erro ao trocar senha')
        setConfig((c) => ({ ...c, senhaAtual: '', novaSenha: '', confirmarSenha: '' }))
      } else {
        const res = await adminFetch('/api/admin/config', {
          method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resto),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Erro ao salvar')
        }
      }

      setFeedback({ type: 'ok', text: 'Configurações salvas com sucesso!' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
      setTimeout(() => setFeedback(null), 5000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="eyebrow mb-2">Sistema</div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>Configurações</h1>
        <p className="hint mt-1">Gerencie as configurações do seu SaaS</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`btn-ghost flex items-center gap-2 ${activeTab === tab.id ? '' : 'opacity-60'}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="glass p-6 rounded-2xl">
        {activeTab === 'geral' && (
          <div className="space-y-6">
            <SectionTitle title="Informações Gerais" description="Dados do seu negócio" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label>Nome do Admin</label>
                <input
                  type="text"
                  value={config.nomeAdmin}
                  onChange={(e) => setConfig({ ...config, nomeAdmin: e.target.value })}
                />
              </div>
              <div>
                <label>E-mail operacional (não altera o login)</label>
                <input
                  type="email"
                  value={config.emailAdmin}
                  onChange={(e) => setConfig({ ...config, emailAdmin: e.target.value })}
                />
              </div>
            </div>

          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            <SectionTitle title="Cobrança da assinatura" description="Valor calculado sobre o faturamento do mês anterior." />
            <div className="overflow-x-auto rounded-xl border p-4">
              <table className="w-full text-sm">
                <thead><tr><th className="pb-2 text-left">Faturamento</th><th className="pb-2 text-right">Mensalidade</th></tr></thead>
                <tbody className="divide-y">
                  {[
                    ['Até R$ 2.000', 'R$ 0'],
                    ['De R$ 2.000,01 a R$ 5.000', 'R$ 50'],
                    ['De R$ 5.000,01 a R$ 10.000', 'R$ 100'],
                    ['De R$ 10.000,01 a R$ 15.000', 'R$ 150'],
                  ].map(([faixa, valor]) => (
                    <tr key={faixa}><td className="py-2">{faixa}</td><td className="py-2 text-right font-semibold">{valor}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="hint mt-2 text-sm">Mais R$ 50 por faixa adicional de R$ 5 mil. Primeiro pagamento após pelo menos 30 dias de cadastro.</p>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
              <div>
                <p><strong>Dia 5:</strong> emissão da fatura do mês anterior.</p>
                <p><strong>Dia 10:</strong> vencimento.</p>
                <p><strong>A partir do dia 11:</strong> fatura vencida em aberto bloqueia os pedidos e o cardápio público.</p>
              </div>
              <Link href="/painel-admin/faturamento" className="btn-ghost">Ver cobranças</Link>
            </div>
            <CheckoutMercadoPago />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <SectionTitle title="Credenciais de Acesso" description="Altere sua senha de admin" />

            <div className="space-y-4 max-w-md">
              <div>
                <label>E-mail de login (somente leitura)</label>
                <input
                  type="email"
                  value={authenticatedAdminEmail}
                  disabled
                  className="opacity-60"
                />
              </div>
              <div>
                <label>Senha Atual</label>
                <input
                  type="password"
                  value={config.senhaAtual}
                  onChange={(e) => setConfig({ ...config, senhaAtual: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label>Nova Senha</label>
                <input
                  type="password"
                  value={config.novaSenha}
                  onChange={(e) => setConfig({ ...config, novaSenha: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label>Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={config.confirmarSenha}
                  onChange={(e) => setConfig({ ...config, confirmarSenha: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'legais' && (
          <div className="space-y-6">
            <SectionTitle title="Rascunhos de documentos legais" description="Textos não publicados." />

            <div>
              <label>Termos de Uso</label>
              <textarea
                value={config.termosUso}
                onChange={(e) => setConfig({ ...config, termosUso: e.target.value })}
                rows={6}
                className="w-full"
              />
              <p className="hint text-xs mt-1">Rascunho dos termos de uso.</p>
            </div>

            <div>
              <label>Política de Privacidade</label>
              <textarea
                value={config.politicaPrivacidade}
                onChange={(e) => setConfig({ ...config, politicaPrivacidade: e.target.value })}
                rows={6}
                className="w-full"
              />
              <p className="hint text-xs mt-1">Rascunho da política de privacidade.</p>
            </div>
          </div>
        )}

        {/* Botão Salvar */}
        {activeTab !== 'financeiro' && <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: 'var(--line)' }}>
          {feedback && (
            <div
              className="text-sm flex items-center gap-2"
              style={{ color: feedback.type === 'ok' ? '#15803D' : '#B91C1C' }}
            >
              {feedback.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
              {feedback.text}
            </div>
          )}
          {!feedback && <span />}
          <button onClick={handleSave} disabled={saving || loading} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>}
      </div>
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
      <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
      <p className="hint text-sm">{description}</p>
    </div>
  )
}
