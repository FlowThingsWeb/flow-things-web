import type { Metadata } from 'next'
import { nombresAlternativos } from '@/lib/sinonimos'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

async function getProducto(slug: string) {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('nombre, descripcion, precio, imagen_url, imagenes, stock, slug, sku, categorias(nombre), variantes(imagen_url, imagenes, activo)')
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
    sku: string | null
    categorias: { nombre: string } | null
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

  const img = imagenDe(p)

  // El catálogo usa el nombre del proveedor ("Canopla"), pero la gente busca
  // "cartuchera". Si la ficha nunca dice esa palabra, no aparece en esa
  // búsqueda por más que el producto exista. Se nombra UNA vez, en la
  // descripción, de forma natural — no repetido para engañar al buscador.
  const alternativos = nombresAlternativos(p.nombre)
  const tambienConocido = alternativos[0]
  const base = p.descripcion || `Comprá ${p.nombre} en Flow Things con envío a todo el país.`
  const descripcion = (
    tambienConocido ? `${base} También podés buscarlo como ${tambienConocido}.` : base
  ).slice(0, 160)

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

  // Product + BreadcrumbList. Los campos extra (sku, categoría, condición,
  // vendedor, devoluciones) son los que Google pide para mostrar el resultado
  // enriquecido con precio y disponibilidad, y los que un asistente necesita
  // para poder decir "está a tanto y hay stock".
  const categoriaNombre = (p?.categorias as { nombre: string } | null)?.nombre
  const jsonLd = p
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.nombre,
          description: p.descripcion || undefined,
          image: imagenDe(p) || undefined,
          sku: p.sku || undefined,
          category: categoriaNombre || undefined,
          // Nombres con los que también se lo busca (canopla → cartuchera).
          ...(nombresAlternativos(p.nombre).length
            ? { alternateName: nombresAlternativos(p.nombre) }
            : {}),
          brand: { '@type': 'Brand', name: 'Flow Things' },
          offers: {
            '@type': 'Offer',
            price: p.precio,
            priceCurrency: 'ARS',
            availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            url: `${BASE}/productos/${slug}`,
            seller: { '@type': 'Organization', name: 'Flow Things', url: BASE },
            hasMerchantReturnPolicy: {
              '@type': 'MerchantReturnPolicy',
              applicableCountry: 'AR',
              returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
              merchantReturnDays: 10,
              returnMethod: 'https://schema.org/ReturnByMail',
              returnFees: 'https://schema.org/FreeReturn',
            },
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE },
            { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${BASE}/productos` },
            { '@type': 'ListItem', position: 3, name: p.nombre },
          ],
        },
      ]
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
