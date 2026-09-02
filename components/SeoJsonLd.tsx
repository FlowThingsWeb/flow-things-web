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

  // Perfiles donde la marca ya existe y Google puede verificar que somos los
  // mismos: es lo que arma el panel de marca al buscar "Flow Things". La
  // tienda oficial de Mercado Libre pesa acá tanto como la red social.
  const redes = [
    cfg.footer_instagram,
    'https://www.mercadolibre.com.ar/tienda/flow-things',
  ].filter(Boolean)

  // Tienda online, sin local a la calle: se declara como OnlineStore y NO se
  // publica la dirección de despacho. Poner una dirección sin atención al
  // público invita a que alguien se presente a comprar, y a Google a evaluar
  // el negocio como local físico cuando no lo es. Lo que sí importa acá es la
  // zona a la que se entrega.
  const tienda: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${BASE}/#tienda`,
    name: nombre,
    description: descripcion,
    url: BASE,
    image: `${BASE}/logo.png`,
    logo: `${BASE}/logo.png`,
    priceRange: '$$',
    currenciesAccepted: 'ARS',
    paymentAccepted: 'Mercado Pago, Tarjeta de crédito, Tarjeta de débito, Transferencia',
    // Dónde entrega, de lo más chico a lo más grande: es lo que responde
    // "juguetería que envíe a mi zona".
    areaServed: [
      { '@type': 'City', name: 'Ciudad Autónoma de Buenos Aires' },
      { '@type': 'AdministrativeArea', name: 'Gran Buenos Aires' },
      { '@type': 'AdministrativeArea', name: 'Provincia de Buenos Aires' },
      { '@type': 'Country', name: 'Argentina' },
    ],
    ...(redes.length ? { sameAs: redes } : {}),
    // Qué vende, en los términos con los que la gente lo busca.
    knowsAbout: [
      'juguetería',
      'juguetería online',
      'librería',
      'librería online',
      'regalería',
      'juguetes',
      'útiles escolares',
      'juegos didácticos',
      'juegos de mesa',
      'regalos',
    ],
    // El catálogo, declarado como tal: enlaza las páginas que compiten por
    // cada término.
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Catálogo Flow Things',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'Juguetería', url: `${BASE}/categoria/jugueteria` },
        { '@type': 'OfferCatalog', name: 'Librería', url: `${BASE}/categoria/libreria` },
      ],
    },
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
