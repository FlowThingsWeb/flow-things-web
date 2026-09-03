import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/productos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/terminos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/cambios-y-devoluciones`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/boton-de-arrepentimiento`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/politica-de-privacidad`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Productos activos
  const { data: productos } = await supabaseAdmin
    .from('productos')
    .select('slug, updated_at, categorias(slug)')
    .eq('activo', true)

  // Una ficha a la que le movimos el precio esta semana se declara como que
  // cambia a diario: es la señal que hace que Google la vuelva a leer antes,
  // en vez de seguir mostrando el precio viejo que tiene indexado.
  const HACE_UNA_SEMANA = Date.now() - 7 * 24 * 60 * 60 * 1000

  const productosUrls: MetadataRoute.Sitemap = (productos || [])
    .filter((p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug))
    .map((p: any) => {
      const modificado = p.updated_at ? new Date(p.updated_at) : undefined
      const reciente = !!modificado && modificado.getTime() > HACE_UNA_SEMANA
      return {
        url: `${BASE}/productos/${p.slug}`,
        lastModified: modificado,
        changeFrequency: (reciente ? 'daily' : 'weekly') as 'daily' | 'weekly',
        priority: reciente ? 0.9 : 0.8,
      }
    })

  // Categorías
  const { data: categorias } = await supabaseAdmin.from('categorias').select('id, slug')
  const visibles = (categorias || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) => !CATEGORIAS_PAUSADAS.includes(c.slug),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categoriasUrls: MetadataRoute.Sitemap = visibles.map((c: any) => ({
    url: `${BASE}/categoria/${c.slug}`,
    changeFrequency: 'weekly' as const,
    // Son las páginas que compiten por "juguetería online" y "librería
    // online": pesan más que una ficha suelta.
    priority: 0.9,
  }))

  /**
   * Subcategorías: /categoria/jugueteria/peluches.
   *
   * Sólo las que tienen productos. Una URL en el sitemap que lleva a una
   * grilla vacía es exactamente lo que Google marca como contenido pobre, y
   * la tabla trae subcategorías sembradas para el futuro que todavía no
   * tienen nada.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porId = new Map(visibles.map((c: any) => [c.id as string, c.slug as string]))
  const { data: subcategorias } = await supabaseAdmin
    .from('subcategorias')
    .select('categoria_id, slug, productos:productos(count)')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subcategoriasUrls: MetadataRoute.Sitemap = ((subcategorias || []) as any[])
    .filter((s) => porId.has(s.categoria_id) && (s.productos?.[0]?.count ?? 0) > 0)
    .map((s) => ({
      url: `${BASE}/categoria/${porId.get(s.categoria_id)}/${s.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  return [...estaticas, ...productosUrls, ...categoriasUrls, ...subcategoriasUrls]
}
