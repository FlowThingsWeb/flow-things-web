import { getConfig } from '@/lib/config'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

/**
 * Datos estructurados del negocio, en el <head> de todas las páginas.
 *
 * Para qué sirve: buscadores y asistentes (Google, ChatGPT, Perplexity) leen
 * este bloque para saber QUÉ es este sitio. Sin él, "Flow Things" es apenas un
 * nombre suelto en el HTML; con él, queda declarado como una tienda de
 * juguetería, librería y regalería en Argentina, con su dirección, su
 * Instagram y su buscador.
 *
 * No garantiza aparecer en ninguna respuesta — eso depende de qué fuentes
 * consulte cada asistente —, pero es el requisito mínimo para ser elegible.
 *
 * Todo sale de la configuración real del sitio; nada está inventado acá.
 */
export default async function SeoJsonLd() {
  const cfg = await getConfig()

  const nombre = cfg.sitio_nombre || 'Flow Things'
  const descripcion =
    'Juguetería, librería y regalería online en Argentina. Juguetes, útiles escolares, ' +
    'juegos didácticos y regalos, con envío a todo el país y hasta 12 cuotas.'

  const redes = [cfg.footer_instagram].filter(Boolean)

  // La dirección sale de `envio_km_origen` (el punto desde donde despachan).
  const direccionRaw = (cfg.envio_km_origen || '').trim()
  const calle = direccionRaw ? direccionRaw.split(',')[0].trim() : null

  const tienda: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${BASE}/#tienda`,
    name: nombre,
    description: descripcion,
    url: BASE,
    image: `${BASE}/logo.png`,
    logo: `${BASE}/logo.png`,
    priceRange: '$$',
    currenciesAccepted: 'ARS',
    paymentAccepted: 'Mercado Pago, Tarjeta de crédito, Tarjeta de débito, Transferencia',
    areaServed: { '@type': 'Country', name: 'Argentina' },
    ...(redes.length ? { sameAs: redes } : {}),
    ...(calle
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: calle,
            addressLocality: 'Ciudad Autónoma de Buenos Aires',
            addressRegion: 'CABA',
            addressCountry: 'AR',
          },
        }
      : {}),
    // Qué vende, en los términos con los que la gente lo busca.
    knowsAbout: [
      'juguetería',
      'librería',
      'regalería',
      'juguetes',
      'útiles escolares',
      'juegos didácticos',
      'regalos',
    ],
  }

  // Declara el buscador interno: permite que un asistente arme un link de
  // búsqueda directo dentro del sitio.
  const web = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE}/#website`,
    url: BASE,
    name: nombre,
    description: descripcion,
    inLanguage: 'es-AR',
    publisher: { '@id': `${BASE}/#tienda` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE}/productos?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify([tienda, web]),
      }}
    />
  )
}
