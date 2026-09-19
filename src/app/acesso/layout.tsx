'use client'

import { ToastProvider } from '@/components/toast'
import GlobalSomPedidos from '@/components/global-som-pedidos'

export default function AcessoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GlobalSomPedidos>
        {children}
      </GlobalSomPedidos>
    </ToastProvider>
  )
}
