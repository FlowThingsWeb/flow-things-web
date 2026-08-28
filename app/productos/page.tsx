import type { Metadata } from 'next'
import Link from 'next/link'
import CatalogoView from '@/components/CatalogoView'
import { getMapaBlur, imagenDeProducto } from '@/lib/blur'
import { getCategorias, getProductos, getRatings, PAGE_SIZE } from '@/lib/catalogo'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

interface PageProps {
  searchParams: Promise<{ categoria?: string; q?: string; orden?: string; page?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams

  if (q) {
    return {
      title: `"${q}" — Buscar en Flow Things`,
      description: `Resultados para "${q}" en juguetería, librería y regalería. Envío a todo el país.`,
      // Las búsquedas no aportan nada al índice y generan URLs infinitas.
      robots: { index: false, follow: true },
      // Sin esto la canonical cae en la del layout, que es la home: la página
      // decía "no me indexes" y "la buena es la home" al mismo tiempo. La
      // buena es el catálogo sin filtrar.
      alternates: { canonical: `${BASE}/productos` },
    }
  }

  const titulo = 'Catálogo — Juguetería, librería y regalería online'
  const desc =
    'Todo el catálogo de Flow Things: juguetes, útiles escolares, juegos didácticos y regalos. Envío a todo el país y hasta 12 cuotas.'
  return {
    title: titulo,
    description: desc,
    alternates: { canonical: `${BASE}/productos` },
    openGraph: {
      title: titulo, description: desc, url: `${BASE}/productos`,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function ProductosPage({ searchParams }: PageProps) {
  const params = await searchParams

  // `categoria` sólo llega acá junto con una búsqueda: sin `q`, next.config
  // redirige a /categoria/<slug>, que es la URL que indexa Google.
  const [items, categorias] = await Promise.all([
    getProductos(params.categoria, params.q),
    getCategorias(),
  ])

  const [ratings, mapaBlur] = await Promise.all([
    getRatings([...new Set(items.map((i) => i.producto.id))]),
    getMapaBlur(),
  ])

  const categoriaActiva = categorias.find((c) => c.slug === params.categoria)

  // ItemList del catálogo completo: le dice a Google qué hay en la página.
  const jsonLd = params.q
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${BASE}/productos#pagina`,
        url: `${BASE}/productos`,
        name: 'Catálogo — Juguetería, librería y regalería online',
        isPartOf: { '@id': `${BASE}/#website` },
        about: { '@id': `${BASE}/#tienda` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.slice(0, PAGE_SIZE).map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.producto.nombre,
            url: `${BASE}/productos/${it.producto.slug}`,
            image: imagenDeProducto(it.producto, it.variante) ?? undefined,
          })),
        },
      }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <nav aria-label="Migas de pan" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <ol className="flex items-center gap-2 text-sm text-brand-text-muted">
          <li><Link href="/" className="hover:text-white">Inicio</Link></li>
          <li aria-hidden="true">›</li>
          <li className="text-brand-text">Catálogo</li>
        </ol>
      </nav>

      <CatalogoView
        items={items}
        categorias={categorias}
        ratings={ratings}
        mapaBlur={mapaBlur}
        categoriaActiva={categoriaActiva?.slug}
        q={params.q}
        orden={params.orden}
        page={params.page}
        basePath="/productos"
        titulo={categoriaActiva ? categoriaActiva.nombre : 'Todo el catálogo'}
      />
    </>
  )
}
