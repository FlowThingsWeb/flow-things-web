import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getMarcas } from '@/lib/catalogo'
import { getMapaBlur, blurDe } from '@/lib/blur'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

/**
 * La pared de marcas: /marcas.
 *
 * Mucha gente no busca "peluche", busca "La Granja de Zenón". Esta página es
 * para esa persona, y de paso le dice a Google que la tienda tiene esas marcas
 * —cada logo es un link con el nombre adentro—, que es exactamente lo que se
 * busca cuando alguien tipea una marca más "comprar".
 *
 * Las marcas salen del SKU de cada producto, que ya estaba mapeado para el
 * feed de Merchant Center: no hay nada que completar al cargar un producto.
 */

export const metadata: Metadata = {
  title: 'Marcas — Todas las marcas que vendemos',
  description:
    'Todas las marcas de juguetería y librería de Flow Things: Craze, Style 4 Ever, La Granja de Zenón, Influencer, Dr. Steve Hunters y más. Envío a todo el país.',
  alternates: { canonical: `${BASE}/marcas` },
  openGraph: {
    title: 'Marcas — Flow Things',
    description: 'Todas las marcas de juguetería y librería que vendemos.',
    url: `${BASE}/marcas`,
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
}

export default async function MarcasPage() {
  const [marcas, mapaBlur] = await Promise.all([getMarcas(), getMapaBlur()])

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${BASE}/marcas#pagina`,
      url: `${BASE}/marcas`,
      name: 'Marcas',
      isPartOf: { '@id': `${BASE}/#website` },
      about: { '@id': `${BASE}/#tienda` },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: marcas.length,
        itemListElement: marcas.map((m, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: m.nombre,
          url: `${BASE}/marcas/${m.slug}`,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Marcas', item: `${BASE}/marcas` },
      ],
    },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Migas de pan" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <ol className="flex items-center gap-2 text-sm text-brand-text-muted">
          <li><Link href="/" className="hover:text-white">Inicio</Link></li>
          <li aria-hidden="true">›</li>
          <li className="text-brand-text">Marcas</li>
        </ol>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-text">Marcas</h1>
          <p className="text-brand-text-muted mt-1">
            {marcas.length} marca{marcas.length !== 1 ? 's' : ''} con productos disponibles
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {marcas.map((m) => (
            <Link
              key={m.slug}
              href={`/marcas/${m.slug}`}
              className="group rounded-2xl border border-brand-border bg-brand-bg-card hover:border-brand-purple hover:shadow-card-hover transition-all hover:-translate-y-1 overflow-hidden"
            >
              {/* Fondo claro detrás del logo: casi todos vienen pensados para
                  catálogo impreso, con tinta oscura, y sobre el fondo negro del
                  sitio se perderían. */}
              <div className="relative h-28 bg-white/90 flex items-center justify-center p-4">
                {m.logo ? (
                  <Image
                    src={m.logo}
                    alt={m.nombre}
                    width={200}
                    height={80}
                    className="max-h-20 w-auto object-contain"
                  />
                ) : m.foto ? (
                  // Sin logo, la foto de un producto suyo: dice más que un
                  // cuadro vacío, y la marca igual va escrita abajo.
                  <Image
                    src={m.foto}
                    alt={m.nombre}
                    fill
                    className="object-cover opacity-90"
                    sizes="(max-width: 640px) 50vw, 25vw"
                    placeholder={blurDe(mapaBlur, m.foto) ? 'blur' : 'empty'}
                    blurDataURL={blurDe(mapaBlur, m.foto)}
                  />
                ) : (
                  <span className="text-xl font-black text-brand-bg text-center leading-tight">
                    {m.nombre}
                  </span>
                )}
              </div>
              <div className="p-3 text-center">
                <span className="block font-semibold text-white text-sm leading-tight group-hover:text-brand-neon transition-colors">
                  {m.nombre}
                </span>
                <span className="block text-brand-text-light text-xs mt-0.5">
                  {m.cantidad} producto{m.cantidad !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
