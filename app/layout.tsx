import type { Metadata } from 'next'
import './globals.css'
import { configParaCliente, getConfig } from '@/lib/config'
import { getCategorias, getSubcategorias } from '@/lib/catalogo'
import { AuthProvider } from '@/lib/auth-context'
import UserShell from '@/components/UserShell'
import SeoJsonLd from '@/components/SeoJsonLd'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar'),
  title: {
    default: 'Flow Things — Juguetería, Librería y Regalería online en Argentina',
    template: '%s | Flow Things',
  },
  description:
    'Juguetería, librería y regalería online en Argentina. Juguetes, útiles escolares, juegos didácticos y regalos, con envío a todo el país y hasta 12 cuotas.',
  keywords: [
    'juguetería online', 'juguetería online argentina', 'librería online',
    'regalería online', 'comprar juguetes online', 'útiles escolares online',
    'juegos didácticos', 'regalos', 'flow things',
  ],
  // La URL canónica sale de la env var, igual que el sitemap. Estaba escrita
  // a mano sin www: el sitio redirige a www, así que og:url apuntaba a una
  // URL distinta de la canónica y eso Search Console lo marca.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: BASE,
    siteName: 'Flow Things',
    title: 'Flow Things — Juguetería, Librería y Regalería online',
    description:
      'Juguetes, útiles escolares, juegos didácticos y regalos con envío a todo el país.',
    // Sin esto, compartir el link en WhatsApp o Instagram no mostraba
    // ninguna imagen: solo texto.
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Flow Things — Juguetería, Librería y Regalería' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flow Things — Juguetería, Librería y Regalería online',
    description: 'Juguetes, útiles escolares, juegos didácticos y regalos con envío a todo el país.',
    images: ['/og-image.png'],
  },
  // Verificación de Google Search Console. Se carga la variable
  // GOOGLE_SITE_VERIFICATION en Vercel con el código que da Google y la
  // etiqueta aparece sola; sin variable, no se renderiza nada.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
}

/**
 * Sanitizador mínimo para CSS inyectado vía design_overrides.
 * No es un sanitizador completo, pero elimina los vectores de abuso más comunes:
 * @import (carga de recursos externos), expression() (IE legacy JS en CSS),
 * y url(javascript:...) (ejecución de JS en browsers antiguos).
 * El riesgo es bajo porque design_overrides solo es editable por admins autenticados.
 */
function sanitizeCss(css: string): string {
  return css
    .replace(/@import\b[^;]*/gi, '/* @import bloqueado */')
    .replace(/expression\s*\(/gi, '/* expression bloqueado */')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(/* js bloqueado */')
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [cfg, categorias, subcategorias] = await Promise.all([
    getConfig(),
    getCategorias(),
    getSubcategorias(),
  ])

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
            dangerouslySetInnerHTML={{ __html: sanitizeCss(cfg.design_overrides) }}
          />
        )}
        {/* Datos estructurados del negocio: qué es Flow Things, dónde está y
            qué vende. Es lo que leen buscadores y asistentes. */}
        <SeoJsonLd />
      </head>
      <body>
        <AuthProvider>
          {/* Sin filtrar, acá cruzaban al browser los cuerpos de los mails
              de notificación y el cupón post-compra. Ver lib/config.ts. */}
          <UserShell cfg={configParaCliente(cfg)} categorias={categorias} subcategorias={subcategorias}>
            {children}
          </UserShell>
        </AuthProvider>
      </body>
    </html>
  )
}
