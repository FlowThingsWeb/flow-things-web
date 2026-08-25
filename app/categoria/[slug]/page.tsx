import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CatalogoView from '@/components/CatalogoView'
import FaqCategoria, { faqDeCategoria } from '@/components/FaqCategoria'
import { getMapaBlur, imagenDeProducto } from '@/lib/blur'
import { COPY_CATEGORIA, getCategorias, getProductos, getRatings, PAGE_SIZE } from '@/lib/catalogo'
import { getConfig } from '@/lib/config'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

/**
 * Cada categoría con su propia URL: /categoria/jugueteria.
 *
 * Antes vivían en /productos?categoria=jugueteria. Un parámetro de consulta le
 * dice poco a Google —es "la misma página con un filtro"—, mientras que una
 * ruta propia con la palabra adentro puede competir por "juguetería online".
 * Además así la página puede tener su propio texto, sus preguntas frecuentes y
 * sus datos estructurados, que una grilla de fotos sola no aporta.
 *
 * La URL vieja redirige acá (ver next.config.js).
 */

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; orden?: string; page?: string }>
}

export async function generateStaticParams() {
  const categorias = await getCategorias()
  return categorias.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const categorias = await getCategorias()
  const cat = categorias.find((c) => c.slug === slug)
  if (!cat) return {}

  const copy = COPY_CATEGORIA[slug]
  const titulo = copy?.titulo ?? `${cat.nombre} — Comprá online con envío a todo el país`
  const desc =
    copy?.desc ??
    `Comprá ${cat.nombre.toLowerCase()} online en Flow Things. Envío a todo el país y hasta 12 cuotas.`
  const url = `${BASE}/categoria/${slug}`

  return {
    title: titulo,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: desc,
      url,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function CategoriaPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams

  const [categorias, cfg] = await Promise.all([getCategorias(), getConfig()])
  const cat = categorias.find((c) => c.slug === slug)
  // Categoría inexistente o pausada: 404 de verdad, no una página vacía que
  // Google indexe.
  if (!cat) notFound()

  const items = await getProductos(slug, sp.q)
  const [ratings, mapaBlur] = await Promise.all([
    getRatings([...new Set(items.map((i) => i.producto.id))]),
    getMapaBlur(),
  ])

  const copy = COPY_CATEGORIA[slug]
  const url = `${BASE}/categoria/${slug}`
  const faq = faqDeCategoria(cat.nombre, cfg)

  // ItemList: le dice a Google qué productos hay en esta página y en qué orden.
  // BreadcrumbList: la ruta Inicio › Catálogo › Categoría, que aparece en el
  // resultado de búsqueda en vez de la URL cruda.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#pagina`,
      url,
      name: copy?.titulo ?? cat.nombre,
      description: copy?.desc,
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
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${BASE}/productos` },
        { '@type': 'ListItem', position: 3, name: cat.nombre, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.pregunta,
        acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
      })),
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
          <li><Link href="/productos" className="hover:text-white">Catálogo</Link></li>
          <li aria-hidden="true">›</li>
          <li className="text-brand-text">{cat.nombre}</li>
        </ol>
      </nav>

      <CatalogoView
        items={items}
        categorias={categorias}
        ratings={ratings}
        mapaBlur={mapaBlur}
        categoriaActiva={slug}
        q={sp.q}
        orden={sp.orden}
        page={sp.page}
        basePath={`/categoria/${slug}`}
        titulo={copy?.h1 ?? cat.nombre}
        intro={copy?.intro}
      />

      <FaqCategoria faq={faq} />
    </>
  )
}
