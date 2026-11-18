'use client'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'

type Step = 'email' | 'code' | 'password' | 'done'

export default function RecoverPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const recoveryClient = useRef<ReturnType<typeof createClient> | null>(null)

  async function requestCode() {
    const address = email.trim().toLowerCase()
    const response = await fetch('/api/auth/recovery-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => null)
      setError(result?.error || 'Não foi possível pedir o código. Tente novamente.')
      return
    }
    setEmail(address)
    setCode('')
    setStep('code')
  }

  async function verifyCode() {
    // Keep the recovery session in memory, independent of the normal login cookies.
    const client = recoveryClient.current ?? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    )
    recoveryClient.current = client
    const { data, error: authError } = await client.auth.verifyOtp({ email, token: code, type: 'recovery' })
    if (authError || !data.session) {
      setError(authError?.status === 429
        ? 'Foram feitas muitas tentativas. Aguarde um minuto.'
        : 'Código inválido ou expirado. Confira o código ou solicite outro.')
      return
    }
    setCode('')
    setStep('password')
  }

  async function savePassword() {
    if (password !== confirmation) {
      setError('As senhas não coincidem.')
      return
    }
    const client = recoveryClient.current
    if (!client) {
      setStep('email')
      setError('Solicite um novo código para continuar.')
      return
    }
    const { error: authError } = await client.auth.updateUser({ password })
    if (authError) {
      if (authError.status === 401 || authError.code === 'session_not_found') {
        recoveryClient.current = null
        setPassword('')
        setConfirmation('')
        setStep('email')
        setError('A verificação expirou. Solicite um novo código.')
        return
      }
      setError(authError.code === 'same_password'
        ? 'Escolha uma senha diferente da atual.'
        : 'Não foi possível atualizar a senha. Escolha uma senha mais forte ou tente novamente.')
      return
    }
    recoveryClient.current = null
    setPassword('')
    setConfirmation('')
    setStep('done')
    await client.auth.signOut({ scope: 'local' }).catch(() => {})
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      if (step === 'email') await requestCode()
      if (step === 'code') await verifyCode()
      if (step === 'password') await savePassword()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="app-shell-inner flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="glass-iridescent relative w-full max-w-md p-8">
          <div className="relative z-10">
            <div className="mb-6 text-center">
              <h1 className="mb-2 text-2xl font-semibold text-[var(--ink)]">Recuperar senha</h1>
              {step === 'email' && <p className="hint">Informe o e-mail que você usa para entrar no We Delivery.</p>}
              {step === 'code' && <p className="hint">Se houver uma conta para <strong>{email}</strong>, o código será enviado para esse endereço. Confira também a pasta de spam.</p>}
              {step === 'password' && <p className="hint">Escolha uma nova senha com pelo menos 8 caracteres.</p>}
              {step === 'done' && <p role="status">Senha atualizada. Você já pode entrar com a nova senha.</p>}
            </div>

            {error && <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            {step !== 'done' && (
              <form onSubmit={submit} className="space-y-4">
                {step === 'email' && (
                  <div>
                    <label htmlFor="recovery-email">E-mail</label>
                    <input id="recovery-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                )}
                {step === 'code' && (
                  <div>
                    <label htmlFor="recovery-code">Código recebido por e-mail</label>
                    <input id="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} pattern="[0-9]{6,10}" required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
                  </div>
                )}
                {step === 'password' && (
                  <>
                    <div>
                      <label htmlFor="recovery-password">Nova senha</label>
                      <input id="recovery-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="recovery-confirmation">Confirme a nova senha</label>
                      <input id="recovery-confirmation" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
                    </div>
                  </>
                )}
                <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
                  {busy ? 'Aguarde…' : { email: 'Enviar código', code: 'Confirmar código', password: 'Salvar nova senha' }[step]}
                </button>
                {step === 'code' && (
                  <button type="button" disabled={busy} className="link w-full text-center text-sm" onClick={() => { setError(''); setStep('email') }}>
                    Reenviar código ou alterar e-mail
                  </button>
                )}
              </form>
            )}

            <div className="mt-5 text-center">
              <Link href="/login" className={step === 'done' ? 'btn-primary w-full justify-center' : 'link text-sm'}>
                Voltar ao login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
