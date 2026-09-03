import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import CatalogoView from '@/components/CatalogoView'
import { filtrosDe, type SearchParams } from '@/components/PaginaCategoria'
import { getMapaBlur, imagenDeProducto } from '@/lib/blur'
import {
  aplicarFiltros, getCategorias, getItemsDeMarca, getMarcas, getRatings, PAGE_SIZE,
} from '@/lib/catalogo'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

/**
 * Todo lo de una marca: /marcas/la-granja-de-zenon.
 *
 * Se renderiza por request, no en el build, por lo mismo que las
 * subcategorías: la lista de marcas sale de los datos, y el modo de render no
 * puede depender de si la base contestó bien en el momento de compilar. Los
 * datos igual salen de caché.
 */
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const marca = (await getMarcas()).find((m) => m.slug === slug)
  if (!marca) return {}

  const titulo = `${marca.nombre} — Comprá online con envío a todo el país`
  const desc =
    `Todos los productos de ${marca.nombre} en Flow Things: ${marca.cantidad} ` +
    `artículo${marca.cantidad !== 1 ? 's' : ''} con envío a todo el país y hasta 12 cuotas.`
  const url = `${BASE}/marcas/${slug}`

  return {
    title: titulo,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: desc,
      url,
      images: [{ url: marca.logo ?? '/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function MarcaPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams

  const [marcas, categorias] = await Promise.all([getMarcas(), getCategorias()])
  const marca = marcas.find((m) => m.slug === slug)
  // Marca inventada en la URL: 404, no una grilla vacía con estado 200.
  if (!marca) notFound()

  const filtros = filtrosDe(sp)
  const itemsBase = await getItemsDeMarca(slug)
  const items = aplicarFiltros(itemsBase, filtros)

  const [ratings, mapaBlur] = await Promise.all([
    getRatings([...new Set(itemsBase.map((i) => i.producto.id))]),
    getMapaBlur(),
  ])

  const url = `${BASE}/marcas/${slug}`
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#pagina`,
      url,
      name: marca.nombre,
      isPartOf: { '@id': `${BASE}/#website` },
      about: { '@type': 'Brand', name: marca.nombre },
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
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Marcas', item: `${BASE}/marcas` },
        { '@type': 'ListItem', position: 3, name: marca.nombre, item: url },
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
          <li><Link href="/marcas" className="hover:text-white">Marcas</Link></li>
          <li aria-hidden="true">›</li>
          <li className="text-brand-text">{marca.nombre}</li>
        </ol>
      </nav>

      {/* El logo arriba del todo: quien entró buscando la marca ve que llegó
          al lugar correcto antes de leer nada. */}
      {marca.logo && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="inline-flex items-center justify-center bg-white/90 rounded-2xl px-6 py-4">
            <Image
              src={marca.logo}
              alt={marca.nombre}
              width={240}
              height={96}
              className="max-h-20 w-auto object-contain"
              priority
            />
          </div>
        </div>
      )}

      <CatalogoView
        items={itemsBase}
        categorias={categorias}
        ratings={ratings}
        mapaBlur={mapaBlur}
        filtros={filtros}
        orden={sp.orden}
        page={sp.page}
        basePath={`/marcas/${slug}`}
        titulo={marca.nombre}
      />
    </>
  )
}
