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

  // Build Google Fonts URL if a custom font is set
  const fontFamily = cfg.design_font_family && cfg.design_font_family !== 'inherit'
    ? cfg.design_font_family
    : null

  const fontUrl = fontFamily
    ? `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;800&display=swap`
    : null

  return (
    <html lang="es">
      <head>
        {fontUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link href={fontUrl} rel="stylesheet" />
          </>
        )}
        {cfg.design_overrides && (
          <style
            id="flow-design-override"
            dangerouslySetInnerHTML={{ __html: cfg.design_overrides }}
          />
        )}
      </head>
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
