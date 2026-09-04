import type { Metadata } from 'next'
import PaginaCategoria, { type SearchParams } from '@/components/PaginaCategoria'
import { COPY_CATEGORIA, getCategorias } from '@/lib/catalogo'

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
  searchParams: Promise<SearchParams>
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
    `Comprá ${cat.nombre.toLowerCase()} online en Flow Things. Envío a todo el país y 3 cuotas sin interés.`
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
  return <PaginaCategoria slug={slug} sp={await searchParams} />
}
