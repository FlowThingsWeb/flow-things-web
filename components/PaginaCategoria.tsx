/**
 * La página de una categoría, con o sin subcategoría abierta.
 *
 * La usan dos rutas: /categoria/jugueteria y /categoria/jugueteria/peluches.
 * Es la misma página —misma grilla, mismos filtros, mismas migas— cambiando
 * qué está seleccionado, así que vive acá y no duplicada en dos archivos.
 *
 * La subcategoría es un segmento de la ruta y no un `?sub=`, por lo mismo que
 * en su momento la categoría dejó de ser `?categoria=`: una URL que dice
 * "peluches" puede competir por esa palabra, un parámetro no.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CatalogoView from '@/components/CatalogoView'
import FaqCategoria, { faqDeCategoria } from '@/components/FaqCategoria'
import { getMapaBlur, imagenDeProducto } from '@/lib/blur'
import {
  COPY_CATEGORIA, aplicarFiltros, getCategorias, getItemsDeCategoria,
  getRatings, getSubcategoriasVisibles, PAGE_SIZE, type Filtros,
} from '@/lib/catalogo'
import { getConfig } from '@/lib/config'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

export type SearchParams = {
  q?: string
  /** Subcategoría cuando no viaja en la ruta (marcas, catálogo completo). */
  sub?: string
  orden?: string
  page?: string
  marca?: string
  min?: string
  max?: string
  disponible?: string
  oferta?: string
}

/** Los parámetros de la URL, ya convertidos a filtros. */
export function filtrosDe(sp: SearchParams, sub?: string): Filtros {
  const num = (v?: string) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }
  return {
    q: sp.q,
    // En /categoria/... la subcategoría llega por la ruta; en /marcas/... por
    // el parámetro, porque ahí no hay ruta que la contenga.
    sub: sub ?? sp.sub,
    marca: sp.marca,
    min: num(sp.min),
    max: num(sp.max),
    disponible: sp.disponible === '1',
    oferta: sp.oferta === '1',
  }
}

export default async function PaginaCategoria({
  slug, sub, sp,
}: {
  slug: string
  sub?: string
  sp: SearchParams
}) {
  const [categorias, subcategorias, cfg] = await Promise.all([
    getCategorias(),
    getSubcategoriasVisibles(),
    getConfig(),
  ])
  const cat = categorias.find((c) => c.slug === slug)
  // Categoría inexistente o pausada: 404 de verdad, no una página vacía que
  // Google indexe.
  if (!cat) notFound()

  const subsDeCategoria = subcategorias.filter((s) => s.categoria_id === cat.id)
  const subActiva = sub ? subsDeCategoria.find((s) => s.slug === sub) : undefined
  // Una subcategoría inventada en la URL tampoco puede devolver una grilla
  // vacía con estado 200.
  if (sub && !subActiva) notFound()

  const filtros = filtrosDe(sp, subActiva?.slug)
  const itemsBase = await getItemsDeCategoria(slug)
  const items = aplicarFiltros(itemsBase, filtros)

  const [ratings, mapaBlur] = await Promise.all([
    getRatings([...new Set(itemsBase.map((i) => i.producto.id))]),
    getMapaBlur(),
  ])

  const copy = COPY_CATEGORIA[slug]
  const basePath = `/categoria/${slug}`
  const url = subActiva ? `${BASE}${basePath}/${subActiva.slug}` : `${BASE}${basePath}`
  const titulo = subActiva ? subActiva.nombre : (copy?.h1 ?? cat.nombre)
  const faq = faqDeCategoria(cat.nombre, cfg)

  // ItemList: le dice a Google qué productos hay en esta página y en qué orden.
  // BreadcrumbList: la ruta Inicio › Catálogo › Categoría › Subcategoría, que
  // aparece en el resultado de búsqueda en vez de la URL cruda.
  const migas = [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Todos los productos', item: `${BASE}/productos` },
    { '@type': 'ListItem', position: 3, name: cat.nombre, item: `${BASE}${basePath}` },
    ...(subActiva
      ? [{ '@type': 'ListItem', position: 4, name: subActiva.nombre, item: url }]
      : []),
  ]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#pagina`,
      url,
      name: subActiva ? `${subActiva.nombre} — ${cat.nombre}` : (copy?.titulo ?? cat.nombre),
      description: subActiva ? undefined : copy?.desc,
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
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: migas },
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
          <li><Link href="/productos" className="hover:text-white">Todos los productos</Link></li>
          <li aria-hidden="true">›</li>
          {subActiva ? (
            <>
              <li><Link href={basePath} className="hover:text-white">{cat.nombre}</Link></li>
              <li aria-hidden="true">›</li>
              <li className="text-brand-text">{subActiva.nombre}</li>
            </>
          ) : (
            <li className="text-brand-text">{cat.nombre}</li>
          )}
        </ol>
      </nav>

      <CatalogoView
        items={itemsBase}
        categorias={categorias}
        subcategorias={subsDeCategoria}
        ratings={ratings}
        mapaBlur={mapaBlur}
        categoriaActiva={slug}
        filtros={filtros}
        orden={sp.orden}
        page={sp.page}
        basePath={basePath}
        titulo={titulo}
        intro={subActiva ? undefined : copy?.intro}
      />

      <FaqCategoria faq={faq} />
    </>
  )
}
