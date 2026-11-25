'use client'

import Link from 'next/link'
import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, BellOff, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NOME_FUNCAO, type FuncaoEquipe } from '@/lib/equipe'
import { useNotificacoes } from './use-equipe'
import './equipe.css'

const MENU: Record<FuncaoEquipe, { href: string; label: string }[]> = {
  kitchen: [{ href: '/acesso/cozinha', label: 'Fluxo' }, { href: '/acesso/cozinha/historico', label: 'Histórico' }],
  attendant: [{ href: '/acesso/garcom', label: 'Mesas' }, { href: '/acesso/garcom/historico', label: 'Histórico' }],
  motoboy: [{ href: '/acesso/motoboy', label: 'Entregas' }],
}

const EquipeContexto = createContext<{ tenantId: string; funcao: FuncaoEquipe }>({ tenantId: '', funcao: 'kitchen' })
export const useEquipe = () => useContext(EquipeContexto)

export default function EquipeShell({ funcao, tenantId, children }: { funcao: FuncaoEquipe; tenantId: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [eu, setEu] = useState<{ nome: string; loja: string } | null>(null)
  const { estado, ativar } = useNotificacoes()
  useEffect(() => { fetch('/api/equipe-app/eu', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setEu).catch(() => {}) }, [])

  const sair = async () => {
    try {
      const registro = await navigator.serviceWorker?.getRegistration('/acesso')
      const inscricao = await registro?.pushManager.getSubscription()
      if (inscricao) {
        await fetch('/api/equipe-app/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: inscricao.endpoint }) })
        await inscricao.unsubscribe()
      }
    } catch { /* segue para sair */ }
    await createClient().auth.signOut()
    window.location.replace('/acesso')
  }

  return <EquipeContexto.Provider value={{ tenantId, funcao }}>
    <div className="wd-equipe">
      <header className="wd-equipe-topo">
        <div className="min-w-0">
          <strong className="block truncate">{eu?.loja || 'WeDelivery'}</strong>
          <small>{NOME_FUNCAO[funcao]}{eu?.nome ? ` · ${eu.nome}` : ''}</small>
        </div>
        <button type="button" onClick={sair} className="wd-equipe-sair" aria-label="Sair"><LogOut size={18} /><span>Sair</span></button>
      </header>

      {estado !== 'ativo' && estado !== 'carregando' && <div className="wd-equipe-aviso" role="status">
        {estado === 'desligado' && <><Bell size={18} /><span>Ative as notificações para ser avisado mesmo usando outros apps.</span><button type="button" onClick={ativar}>Ativar</button></>}
        {estado === 'bloqueado' && <><BellOff size={18} /><span>Notificações bloqueadas. Libere nas configurações do navegador para este site.</span></>}
        {estado === 'instalar_iphone' && <><Bell size={18} /><span>No iPhone: toque em Compartilhar → “Adicionar à Tela de Início”, abra o app e ative as notificações.</span></>}
        {estado === 'sem_suporte' && <><BellOff size={18} /><span>Este navegador não recebe notificações. Mantenha esta tela aberta.</span></>}
      </div>}

      {MENU[funcao].length > 1 && <nav className="wd-equipe-menu" aria-label="Menu">
        {MENU[funcao].map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}
      </nav>}

      <main className="wd-equipe-conteudo">{children}</main>
    </div>
  </EquipeContexto.Provider>
}
