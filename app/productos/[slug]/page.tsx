import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'
import ProductoDetalle, { type ConfigFicha } from '@/components/ProductoDetalle'
import { Producto } from '@/types'

/**
 * Ficha de producto, renderizada en el servidor.
 *
 * Antes la página era un componente de cliente que pedía el producto en un
 * useEffect: el HTML salía con el cascarón y nada más. Google rastrea sin
 * ejecutar JavaScript en la primera pasada, así que veía una ficha sin
 * descripción, sin precio y sin botón — y la dejaba en "Rastreada:
 * actualmente sin indexar".
 *
 * Ahora los datos se cargan acá y bajan por props. La interactividad
 * (variantes, galería, carrito) sigue en el componente de cliente.
 */

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ variante?: string }>
}

// Las fichas cambian poco; se regeneran cada 5 minutos.
export const revalidate = 300

async function getProducto(slug: string): Promise<Producto | null> {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('*, categorias(id, nombre, slug), variantes(*)')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()
  return (data as Producto) ?? null
}

/** Otros productos activos de la misma categoría. */
async function getRelacionados(productoId: string, categoriaId?: string | null): Promise<Producto[]> {
  if (!categoriaId) return []
  const { data } = await supabaseAdmin
    .from('productos')
    .select('*, categorias(id, nombre, slug), variantes(id, imagen_url, imagenes, activo)')
    .eq('activo', true)
    .eq('categoria_id', categoriaId)
    .neq('id', productoId)
    .limit(4)
  return (data as Producto[]) ?? []
}

async function getConfigFicha(): Promise<ConfigFicha> {
  const { data } = await supabaseAdmin
    .from('configuracion')
    .select('clave, valor')
    .in('clave', [
      'footer_telefono', 'footer_email',
      'envio_gratis_caba_desde', 'envio_gratis_amba_desde',
      'envio_gratis_gba_desde', 'envio_gratis_interior_desde',
    ])

  const cfg: Record<string, string> = {}
  for (const row of data || []) if (row.valor) cfg[row.clave] = row.valor

  return {
    telefono: cfg.footer_telefono || '+54 9 11 5607 5633',
    email: cfg.footer_email || 'contacto@flowthings.com.ar',
    gratisCaba: Number(cfg.envio_gratis_caba_desde) || 40000,
    // AMBA: clave propia, o el valor viejo de 'gba' como respaldo.
    gratisAmba: Number(cfg.envio_gratis_amba_desde) || Number(cfg.envio_gratis_gba_desde) || 60000,
    gratisInterior: Number(cfg.envio_gratis_interior_desde) || 120000,
  }
}

export default async function ProductoPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { variante } = await searchParams

  const producto = await getProducto(slug)
  if (!producto) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catSlug = (producto.categorias as any)?.slug
  if (catSlug && CATEGORIAS_PAUSADAS.includes(catSlug)) notFound()

  const [config, relacionados] = await Promise.all([
    getConfigFicha(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getRelacionados(producto.id, (producto as any).categoria_id ?? (producto.categorias as any)?.id),
  ])

  return (
    <ProductoDetalle
      producto={producto}
      config={config}
      varianteParam={variante ?? null}
      relacionados={relacionados}
    />
  )
}
