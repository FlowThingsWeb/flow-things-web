import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CartDrawer from '@/components/CartDrawer'
import AnnouncementBar from '@/components/AnnouncementBar'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Flow Things — Librería & Juguetería',
    template: '%s | Flow Things',
  },
  description:
    'Descubrí los mejores productos de librería y juguetería en Flow Things. Útiles escolares, juegos, juguetes y mucho más con envío a todo el país.',
  keywords: ['librería', 'juguetería', 'útiles escolares', 'juguetes', 'flow things'],
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://flowthings.com.ar',
    siteName: 'Flow Things',
    title: 'Flow Things — Librería & Juguetería',
    description: 'Los mejores productos de librería y juguetería',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cfg = await getConfig()

  return (
    <html lang="es">
      <body>
        <AnnouncementBar />
        <Header cfg={cfg} />
        <main className="min-h-screen">{children}</main>
        <CartDrawer />
        <Footer cfg={cfg} />
      </body>
    </html>
  )
}
