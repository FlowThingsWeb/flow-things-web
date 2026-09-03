import type { Metadata } from 'next'
import PaginaCategoria, { type SearchParams } from '@/components/PaginaCategoria'
import { getCategorias, getSubcategorias } from '@/lib/catalogo'

/**
 * Se renderiza por request, no en el build.
 *
 * Tenía `generateStaticParams`, y ahí estuvo el problema: la lista de
 * subcategorías sale de la base, así que un build hecho antes de la migración
 * la devolvía vacía. Con la lista vacía Next igual sirve la ruta, pero la
 * renderiza en modo estático — y esta página lee `searchParams` para los
 * filtros, que es justamente lo que no se puede leer en modo estático:
 * DYNAMIC_SERVER_USAGE, 500 en todas las subcategorías.
 *
 * No es que faltara un dato: es que el modo de render dependía de si la base
 * estaba lista en el momento del build, y eso no puede decidir si la página
 * funciona. Los datos igual salen de caché (unstable_cache, 60s), así que
 * renderizar por request cuesta poco, y el HTML sigue completo para Google.
 */
export const dynamic = 'force-dynamic'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

/**
 * El segundo nivel del catálogo: /categoria/jugueteria/peluches.
 *
 * Cada tipo de producto con su propia URL, por lo mismo que las categorías
 * dejaron de vivir en `?categoria=`: alguien que busca "peluches" en Google
 * puede llegar acá, y la página puede decir en su título y sus migas de pan
 * exactamente qué es. Un `?sub=peluches` sería la misma grilla con un filtro.
 *
 * La página en sí es la misma que la de la categoría —mismo componente— con
 * la subcategoría ya elegida.
 */

interface Props {
  params: Promise<{ slug: string; sub: string }>
  searchParams: Promise<SearchParams>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, sub } = await params
  const [categorias, subcategorias] = await Promise.all([getCategorias(), getSubcategorias()])
  const cat = categorias.find((c) => c.slug === slug)
  const sc = subcategorias.find((s) => s.slug === sub && s.categoria_id === cat?.id)
  if (!cat || !sc) return {}

  const titulo = `${sc.nombre} — Comprá online con envío a todo el país`
  const desc =
    `Comprá ${sc.nombre.toLowerCase()} online en Flow Things. ` +
    `${cat.nombre} con envío a CABA, Gran Buenos Aires y todo el país, y hasta 12 cuotas.`
  const url = `${BASE}/categoria/${slug}/${sub}`

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

export default async function SubcategoriaPage({ params, searchParams }: Props) {
  const { slug, sub } = await params
  return <PaginaCategoria slug={slug} sub={sub} sp={await searchParams} />
}
