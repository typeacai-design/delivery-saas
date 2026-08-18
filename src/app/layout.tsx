import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://wedelivery.site'),
  title: {
    default: 'We Delivery — Cardápio digital para restaurantes',
    template: '%s | We Delivery',
  },
  description: 'Cardápio digital, pedidos no WhatsApp e gestão de delivery para restaurantes e lanchonetes.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'We Delivery',
    title: 'We Delivery — Cardápio digital para restaurantes',
    description: 'Receba pedidos online e gerencie seu delivery em um só lugar.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Playfair+Display:wght@600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
