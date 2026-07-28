import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

async function getProducto(slug: string) {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('nombre, descripcion, precio, imagen_url, imagenes, stock, slug, variantes(imagen_url, imagenes, activo)')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()
  return data as {
    nombre: string
    descripcion: string | null
    precio: number
    imagen_url: string | null
    imagenes: string[] | null
    stock: number
    slug: string
    variantes: { imagen_url: string | null; imagenes: string[] | null; activo: boolean }[] | null
  } | null
}

/**
 * Imagen para el preview al compartir (Open Graph). Los productos que cargan
 * las fotos en las variantes no tienen imagen propia, así que caemos a la
 * primera variante activa con imagen — si no, se veía el logo de Flow Things.
 */
function imagenDe(p: {
  imagen_url: string | null
  imagenes: string[] | null
  variantes?: { imagen_url: string | null; imagenes: string[] | null; activo: boolean }[] | null
}): string | null {
  if (p.imagen_url) return p.imagen_url
  if (p.imagenes?.[0]) return p.imagenes[0]
  const v = (p.variantes || []).find(
    (v) => v.activo !== false && (v.imagen_url || v.imagenes?.[0]),
  )
  return v?.imagen_url || v?.imagenes?.[0] || null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = await getProducto(slug)
  if (!p) return { title: 'Producto no encontrado' }

  const descripcion = (p.descripcion || `Comprá ${p.nombre} en Flow Things con envío a todo el país.`).slice(0, 160)
  const img = imagenDe(p)

  return {
    title: p.nombre,
    description: descripcion,
    alternates: { canonical: `${BASE}/productos/${slug}` },
    openGraph: {
      type: 'website',
      title: p.nombre,
      description: descripcion,
      url: `${BASE}/productos/${slug}`,
      images: img ? [img] : undefined,
    },
  }
}

export default async function ProductoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = await getProducto(slug)

  const jsonLd = p
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.nombre,
        description: p.descripcion || undefined,
        image: imagenDe(p) || undefined,
        offers: {
          '@type': 'Offer',
          price: p.precio,
          priceCurrency: 'ARS',
          availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${BASE}/productos/${slug}`,
        },
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  )
}
