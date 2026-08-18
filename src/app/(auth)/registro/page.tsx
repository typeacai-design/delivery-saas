'use client'

import { useState, useEffect } from 'react'
import { getCidadesByEstado } from '@/lib/cidades-brasil'
import Link from 'next/link'
import { ChefHat, ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { InputField, SelectField, SearchableSelect } from '@/components/form-field'
import { ESTADOS } from '@/lib/cidades-brasil'

const ESTADOS_LIST = ESTADOS.map((e) => e.uf)

const CATEGORIAS = [
  'Açaiteria', 'Pizzaria', 'Hamburgueria', 'Lanchonete', 'Restaurante',
  'Marmitaria', 'Padaria', 'Cafeteria', 'Doceria', 'Sorveteria',
  'Pastelaria', 'Bar ou petiscaria', 'Comida japonesa', 'Comida saudável', 'Outros'
]

export default function RegistroPage() {
  const [referralCode, setReferralCode] = useState('')
  useEffect(() => { setReferralCode(new URLSearchParams(window.location.search).get('ref') || '') }, [])
  // Etapas
  const [step, setStep] = useState<'negocio' | 'localizacao' | 'responsavel' | 'sucesso'>('negocio')

  // Dados do negócio
  const [nomeNegocio, setNomeNegocio] = useState('')
  const [categoria, setCategoria] = useState('Outros')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [telefone, setTelefone] = useState('')

  // Localização
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')

  // Responsável
  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [cpf, setCpf] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formatPhone = (v: string) => {
    const c = v.replace(/\D/g, '')
    if (c.length <= 11) return c.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
    return v
  }

  const formatCpf = (v: string) => {
    const c = v.replace(/\D/g, '').slice(0, 11)
    return c
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
      .replace(/(\d{3})(\d{3})/, '$1.$2')
      .trim()
  }

  const canProceed = () => {
    if (step === 'negocio') return nomeNegocio && categoria && email && password.length >= 6 && telefone
    if (step === 'localizacao') return estado && cidade && endereco && numero
    if (step === 'responsavel') return nomeResponsavel && cpf.replace(/\D/g, '').length === 11
    return false
  }

  // Cidades filtradas pelo estado selecionado (lazy load)
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([])

  useEffect(() => {
    if (!estado) {
      setCidadesDisponiveis([])
      setCidade('')
      return
    }
    let cancelled = false
    getCidadesByEstado(estado).then((lista) => {
      if (!cancelled) setCidadesDisponiveis(lista)
    })
    return () => { cancelled = true }
  }, [estado])

  const handleNext = () => {
    if (!canProceed()) {
      setError('Preencha todos os campos')
      return
    }
    setError('')
    if (step === 'negocio') setStep('localizacao')
    else if (step === 'localizacao') setStep('responsavel')
    else handleSubmit()
  }

  const handleBack = () => {
    setError('')
    if (step === 'localizacao') setStep('negocio')
    else if (step === 'responsavel') setStep('localizacao')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const enderecoCompleto = numero ? `${endereco}, ${numero}` : endereco
    try {
      const tenantRes = await fetch('/api/register/tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: nomeNegocio.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          nome: nomeNegocio, email, password, categoria, telefone, estado, cidade,
          endereco: enderecoCompleto, numero, nome_responsavel: nomeResponsavel, cpf,
          referral_code: referralCode,
        }),
      })
      const data = await tenantRes.json().catch(() => ({}))
      if (!tenantRes.ok) {
        setError(data.error || 'Não foi possível enviar o cadastro para análise.')
        return
      }
      setStep('sucesso')
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'sucesso') {
    return (
      <div className="app-shell">
        <div className="app-shell-inner flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="max-w-md w-full text-center">
            <div className="size-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,.14)' }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: '#15803D' }} strokeWidth={2} />
            </div>
            <div className="eyebrow mb-3">Quase lá</div>
            <h1 className="text-3xl font-semibold mb-3" style={{ color: 'var(--ink)' }}>
              Cadastro enviado para análise!
            </h1>
            <p className="hint mb-8">
              Seu perfil foi enviado para análise. Um administrador irá analisá-lo e aprová-lo em breve.
            </p>
            <Link href="/login" className="btn-ghost inline-flex items-center gap-2">
              Voltar pro login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const stepTitles = {
    negocio: { title: 'Seu negócio', subtitle: 'Vamos começar com o essencial' },
    localizacao: { title: 'Localização', subtitle: 'Onde fica sua loja' },
    responsavel: { title: 'Responsável', subtitle: 'Quem vai administrar a conta' },
  }

  return (
    <div className="app-shell">
      <div className="app-shell-inner flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2.5 mb-7">
            <div
              className="size-11 rounded-2xl flex items-center justify-center text-white"
              style={{
                background: 'var(--green)',
                border: '1px solid rgba(255,255,255,.4)',
                boxShadow: '0 8px 22px -10px rgba(22,163,74,.55)',
              }}
            >
              <ChefHat size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              We Delivery
            </span>
          </div>

          <div className="glass-iridescent p-8 relative">
            <div className="relative z-10">
              {/* Indicador de step */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {['negocio', 'localizacao', 'responsavel'].map((s, i) => {
                  const active = s === step
                  const completed = ['negocio', 'localizacao', 'responsavel'].indexOf(step) > i
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div
                        className="size-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: active || completed ? 'var(--green)' : 'rgba(0,0,0,.06)',
                          color: active || completed ? 'white' : 'var(--ink-muted)',
                        }}
                      >
                        {completed ? '✓' : i + 1}
                      </div>
                      {i < 2 && <div className="w-6 h-px" style={{ background: completed ? 'var(--green)' : 'rgba(0,0,0,.1)' }} />}
                    </div>
                  )
                })}
              </div>

              <div className="text-center mb-7">
                <div className="eyebrow mb-2">{stepTitles[step as keyof typeof stepTitles].title}</div>
                <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                  {stepTitles[step as keyof typeof stepTitles].title}
                </h1>
                <p className="hint">{stepTitles[step as keyof typeof stepTitles].subtitle}</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleNext() }} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-2xl text-[13px]" style={{ background: 'rgba(220,38,38,.08)', color: '#991B1B', border: '1px solid rgba(220,38,38,.25)' }}>
                    {error}
                  </div>
                )}

                {step === 'negocio' && (
                  <>
                    <InputField
                      label="Nome do negócio"
                      value={nomeNegocio}
                      onChange={(e) => setNomeNegocio(e.target.value)}
                      placeholder="Lanche Legal"
                      required
                    />
                    <SelectField
                      label="Categoria do negócio"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </SelectField>
                    <InputField
                      label="Telefone / WhatsApp"
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      required
                    />
                    <InputField
                      label="E-mail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                    <InputField
                      label="Senha de acesso"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      rightAdornment={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                  </>
                )}

                {step === 'localizacao' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField
                        label="Estado"
                        value={estado}
                        onChange={(e) => { setEstado(e.target.value); setCidade('') }}
                        required
                      >
                        <option value="">Selecione</option>
                        {ESTADOS_LIST.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </SelectField>
                      <SearchableSelect
                        label="Cidade"
                        options={cidadesDisponiveis}
                        value={cidade}
                        onChange={setCidade}
                        placeholder={estado ? 'Selecione' : 'Escolha o estado'}
                        disabled={!estado}
                        required
                      />
                    </div>
                    <InputField
                      label="Endereço (logradouro)"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Rua das Flores"
                      required
                    />
                    <InputField
                      label="Número"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      required
                    />
                  </>
                )}

                {step === 'responsavel' && (
                  <>
                    <InputField
                      label="Nome completo do responsável"
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      placeholder="João da Silva"
                      required
                    />
                    <InputField
                      label="CPF do responsável"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      required
                      maxLength={14}
                    />
                  </>
                )}

                <div className="flex gap-3 mt-2">
                  {step !== 'negocio' && (
                    <button type="button" onClick={handleBack} className="btn-ghost">
                      <ChevronLeft size={14} />
                      Voltar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1 justify-center"
                  >
                    {loading ? 'Criando...' : step === 'responsavel' ? 'Criar conta' : 'Continuar'}
                    {!loading && <ArrowRight size={14} />}
                  </button>
                </div>
              </form>

              <div className="mt-7 pt-5 divider" />
              <p className="hint text-center mt-5">
                Já tem conta?{' '}
                <Link href="/login" className="link">
                  Entrar
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center hint mt-6">
            © {new Date().getFullYear()} We Delivery Â· Delivery simples
          </p>
        </div>
      </div>
    </div>
  )
}
