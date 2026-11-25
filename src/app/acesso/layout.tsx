import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'WeDelivery Equipe',
  manifest: '/manifest-equipe.webmanifest',
  appleWebApp: { capable: true, title: 'Equipe', statusBarStyle: 'default' },
}
export const viewport: Viewport = { themeColor: '#16a34a' }

export default function AcessoLayout({ children }: { children: React.ReactNode }) {
  return children
}
