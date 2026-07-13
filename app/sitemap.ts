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

  const productosUrls: MetadataRoute.Sitemap = (productos || [])
    .filter((p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug))
    .map((p: any) => ({
      url: `${BASE}/productos/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  // Categorías
  const { data: categorias } = await supabaseAdmin.from('categorias').select('slug')
  const categoriasUrls: MetadataRoute.Sitemap = (categorias || [])
    .filter((c: any) => !CATEGORIAS_PAUSADAS.includes(c.slug))
    .map((c: any) => ({
      url: `${BASE}/productos?categoria=${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  return [...estaticas, ...productosUrls, ...categoriasUrls]
}
