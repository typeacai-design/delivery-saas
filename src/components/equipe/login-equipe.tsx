'use client'

import { useState } from 'react'
import { Eye, EyeOff, Smartphone } from 'lucide-react'
import './equipe.css'

const mascara = (valor: string) => {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function LoginEquipe({ semAcesso }: { semAcesso: boolean }) {
  const [celular, setCelular] = useState('')
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState(semAcesso ? 'Este acesso não está ativo. Fale com o responsável da loja.' : '')

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault(); setEntrando(true); setErro('')
    try {
      const r = await fetch('/api/auth/equipe-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ celular, senha }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(b.error || 'Não foi possível entrar'); setEntrando(false); return }
      window.location.replace(b.destino)
    } catch { setErro('Sem conexão. Tente novamente.'); setEntrando(false) }
  }

  return <div className="wd-equipe" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <form onSubmit={entrar} className="wd-eq-card" style={{ width: '100%', maxWidth: 380, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/we-delivery-official-green.svg" alt="" width={48} height={48} style={{ margin: '0 auto 8px' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Acesso da equipe</h1>
        <p style={{ color: '#5d7063', fontSize: 14, margin: '4px 0 0' }}>Cozinha, garçom e motoboy</p>
      </div>
      <label style={{ fontSize: 14, fontWeight: 600 }}>Celular
        <div style={{ position: 'relative', marginTop: 6 }}>
          <Smartphone size={18} style={{ position: 'absolute', left: 12, top: 14, color: '#8a978e' }} />
          <input required inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={celular} onChange={e => setCelular(mascara(e.target.value))}
            style={{ width: '100%', padding: '12px 12px 12px 38px', border: '1px solid #dfe7e1', borderRadius: 12, fontSize: 16 }} />
        </div>
      </label>
      <label style={{ fontSize: 14, fontWeight: 600 }}>Senha
        <div style={{ position: 'relative', marginTop: 6 }}>
          <input required type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)}
            style={{ width: '100%', padding: '12px 44px 12px 12px', border: '1px solid #dfe7e1', borderRadius: 12, fontSize: 16 }} />
          <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} style={{ position: 'absolute', right: 8, top: 8, padding: 6, background: 'none', border: 0 }}>{ver ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
      </label>
      {erro && <p className="wd-equipe-erro" role="alert" style={{ margin: 0 }}>{erro}</p>}
      <button type="submit" className="wd-eq-botao" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</button>
      <p style={{ fontSize: 12, color: '#748178', textAlign: 'center', margin: 0 }}>Esqueceu a senha? Peça ao responsável da loja para redefinir.</p>
    </form>
  </div>
}
