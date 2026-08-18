'use client'

import { useEffect, useState } from 'react'
import { Settings, Mail, DollarSign, Lock, Bell, FileText, Shield, Save, Check, AlertCircle, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { adminFetch } from '@/lib/admin-fetch'
import { useRouter, useSearchParams } from 'next/navigation'

const DEFAULTS = {
  valorMensalidade: '99.90',
  valorMinimo: '49.90',
  emailCobranca: '',
  nomeAdmin: 'Rick Machado',
  emailAdmin: '',
  senhaAtual: '',
  novaSenha: '',
  confirmarSenha: '',
  termosUso: 'Termos de uso padrão para lojistas...',
  politicaPrivacidade: 'Política de privacidade padrão...',
  notificarVencimento: true,
  notificarNovoCadastro: true,
  notificarInadimplencia: true,
}

export default function ConfiguracoesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'admin' ? 'admin' : 'geral')
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
    const tab = searchParams.get('tab')
    setActiveTab(['geral', 'financeiro', 'admin', 'notificacoes', 'legais'].includes(tab || '') ? tab! : 'geral')
  }, [searchParams])

  const selectTab = (tab: string) => {
    setActiveTab(tab)
    router.replace('/painel-admin/configuracoes?tab=' + encodeURIComponent(tab), { scroll: false })
  }

  const tabs = [
    { id: 'geral', label: 'Geral', icon: Settings },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'admin', label: 'Perfil e segurança', icon: Shield },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
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

            <div>
              <label>Email para Cobranças</label>
              <input
                type="email"
                value={config.emailCobranca}
                onChange={(e) => setConfig({ ...config, emailCobranca: e.target.value })}
              />
              <p className="hint text-xs mt-1">Email usado para enviar cobranças aos lojistas</p>
            </div>
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            <SectionTitle title="Configurações Financeiras" description="Valores e políticas de pagamento" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label>Valor Padrão da Mensalidade (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.valorMensalidade}
                  onChange={(e) => setConfig({ ...config, valorMensalidade: e.target.value })}
                />
                <p className="hint text-xs mt-1">Valor cobrado por padrão de novos lojistas</p>
              </div>
              <div>
                <label>Valor Mínimo Aceito (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.valorMinimo}
                  onChange={(e) => setConfig({ ...config, valorMinimo: e.target.value })}
                />
                <p className="hint text-xs mt-1">Menor valor aceito para planos</p>
              </div>
            </div>

            <div className="p-4 rounded-xl" style={{ background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.2)' }}>
              <p className="font-medium text-sm mb-2" style={{ color: 'var(--green)' }}>Resumo Financeiro</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold gradient-text">{formatCurrency(Number(config.valorMensalidade))}</p>
                  <p className="hint text-xs">Mensalidade padrão</p>
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{formatCurrency(Number(config.valorMinimo))}</p>
                  <p className="hint text-xs">Mínimo aceito</p>
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>10</p>
                  <p className="hint text-xs">Dia do vencimento</p>
                </div>
              </div>
            </div>
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

        {activeTab === 'notificacoes' && (
          <div className="space-y-6">
            <SectionTitle title="Preferências de Notificação" description="Escolha quais emails receber" />

            <div className="space-y-4">
              <ToggleField
                label="Avisar vencimento de mensalidade"
                description="Receba um email 3 dias antes do vencimento"
                checked={config.notificarVencimento}
                onChange={(v) => setConfig({ ...config, notificarVencimento: v })}
              />
              <ToggleField
                label="Novo cadastro de lojista"
                description="Receba um email quando um novo lojista se cadastrar"
                checked={config.notificarNovoCadastro}
                onChange={(v) => setConfig({ ...config, notificarNovoCadastro: v })}
              />
              <ToggleField
                label="Alerta de inadimplência"
                description="Receba um email quando um lojista ficar inadimplente"
                checked={config.notificarInadimplencia}
                onChange={(v) => setConfig({ ...config, notificarInadimplencia: v })}
              />
            </div>
          </div>
        )}

        {activeTab === 'legais' && (
          <div className="space-y-6">
            <SectionTitle title="Documentos Legais" description="Termos e políticas exibidos aos lojistas" />

            <div>
              <label>Termos de Uso</label>
              <textarea
                value={config.termosUso}
                onChange={(e) => setConfig({ ...config, termosUso: e.target.value })}
                rows={6}
                className="w-full"
              />
              <p className="hint text-xs mt-1">Texto exibido na aceitação de termos ao criar conta</p>
            </div>

            <div>
              <label>Política de Privacidade</label>
              <textarea
                value={config.politicaPrivacidade}
                onChange={(e) => setConfig({ ...config, politicaPrivacidade: e.target.value })}
                rows={6}
                className="w-full"
              />
              <p className="hint text-xs mt-1">Texto exibido na política de privacidade</p>
            </div>
          </div>
        )}

        {/* Botão Salvar */}
        <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: 'var(--line)' }}>
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
        </div>
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

function ToggleField({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(0,0,0,.03)' }}>
      <div>
        <p className="font-medium text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
        <p className="hint text-xs">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-all ${checked ? '' : 'opacity-50'}`}
        style={{ background: checked ? 'var(--green)' : 'rgba(0,0,0,.2)' }}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all shadow ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  )
}
