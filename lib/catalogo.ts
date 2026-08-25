/**
 * Datos y copy del catálogo, compartidos por /productos y /categoria/[slug].
 *
 * Vivían dentro de app/productos/page.tsx. Se mudaron acá cuando cada
 * categoría pasó a tener su propia URL: las dos rutas muestran la misma
 * grilla y no tiene sentido mantener dos copias de la consulta.
 */
import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Producto, Variante } from '@/types'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'
import { contieneConSinonimos, normalizar } from '@/lib/sinonimos'

export const PAGE_SIZE = 24

export type CatalogItem = {
  producto: Producto
  variante: Variante | null
}

export type Categoria = { id: string; nombre: string; slug: string }

/**
 * Título, descripción y texto de cada categoría.
 *
 * El texto no es relleno: una página de categoría que es sólo una grilla de
 * fotos no le dice a Google de qué es. Estos párrafos usan las palabras con
 * las que la gente busca y describen lo que el sitio realmente hace.
 */
export const COPY_CATEGORIA: Record<
  string,
  { titulo: string; h1: string; desc: string; intro: string }
> = {
  jugueteria: {
    titulo: 'Juguetería online — Juguetes con envío a todo el país',
    h1: 'Juguetería online',
    desc:
      'Comprá juguetes online en Argentina: juegos didácticos, peluches, muñecos y juegos de mesa. Envío a todo el país y hasta 12 cuotas.',
    intro:
      'Juguetería online con envío a CABA, Gran Buenos Aires y todo el país. ' +
      'Tenemos juegos didácticos, peluches, muñecos, juegos de mesa y sets de ' +
      'actividades para regalar o para jugar en casa. Comprás por la web, pagás ' +
      'con Mercado Pago en hasta 12 cuotas y te lo enviamos a tu domicilio.',
  },
  libreria: {
    titulo: 'Librería online — Útiles escolares y artículos de librería',
    h1: 'Librería online',
    desc:
      'Comprá artículos de librería online en Argentina: cuadernos, carpetas, canoplas y útiles escolares. Envío a todo el país y hasta 12 cuotas.',
    intro:
      'Librería online con envío a CABA, Gran Buenos Aires y todo el país. ' +
      'Cuadernos, carpetas, canoplas, portalápices y útiles escolares de las ' +
      'marcas que se piden en la lista del colegio. Comprás por la web, pagás ' +
      'con Mercado Pago en hasta 12 cuotas y te lo enviamos a tu domicilio.',
  },
  'juegos-de-mesa': {
    titulo: 'Juegos de mesa online — Para jugar en familia',
    h1: 'Juegos de mesa',
    desc:
      'Comprá juegos de mesa online en Argentina: juegos para toda la familia, de estrategia y para chicos. Envío a todo el país y hasta 12 cuotas.',
    intro:
      'Juegos de mesa para jugar en familia o con amigos, con envío a CABA, ' +
      'Gran Buenos Aires y todo el país. Comprás por la web, pagás con Mercado ' +
      'Pago en hasta 12 cuotas y te lo enviamos a tu domicilio.',
  },
}

// La consulta trae todo el catálogo activo y filtra en JS, así que NO depende
// de los parámetros: una sola entrada de caché sirve a todas las categorías,
// búsquedas y ordenamientos.
const CACHE = { revalidate: 60, tags: ['catalogo'] }

export const getCatalogoCompleto = unstable_cache(async (): Promise<Producto[]> => {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('*, categorias(id, nombre, slug), variantes(*)')
    .eq('activo', true)
    .order('created_at', { ascending: false })
  return (data || []) as Producto[]
}, ['catalogo-completo'], CACHE)

export async function getProductos(categoria?: string, q?: string): Promise<CatalogItem[]> {
  let productos: Producto[] = await getCatalogoCompleto()

  // Excluir categorías pausadas
  productos = productos.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: Producto) => !CATEGORIAS_PAUSADAS.includes((p.categorias as any)?.slug)
  )

  if (categoria) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    productos = productos.filter((p: Producto) => (p.categorias as any)?.slug === categoria)
  }

  // Una tarjeta por variante activa, o una sola si el producto no tiene.
  const items: CatalogItem[] = []
  for (const producto of productos) {
    const variantesActivas: Variante[] = ((producto.variantes || []) as Variante[]).filter(v => v.activo)
    if (variantesActivas.length > 0) {
      for (const variante of variantesActivas) items.push({ producto, variante })
    } else {
      items.push({ producto, variante: null })
    }
  }

  // Cada tarjeta se filtra sola: la de una variante sólo entra si el término
  // aparece en ESA variante.
  if (q?.trim()) {
    const words = normalizar(q).split(/\s+/).filter(Boolean)
    return items.filter(({ producto, variante }) => {
      const haystack = normalizar([
        producto.nombre,
        producto.descripcion ?? '',
        ...(variante ? Object.values(variante.atributos) : []),
      ].join(' '))
      // Con sinónimos y sin tildes: "cartuchera" encuentra las canoplas, y
      // "portalapices" encuentra "Portalápices".
      return words.every(w => contieneConSinonimos(haystack, w))
    })
  }

  return items
}

export async function getCategorias(): Promise<Categoria[]> {
  const { data } = await supabaseAdmin.from('categorias').select('*')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).filter((c: any) => !CATEGORIAS_PAUSADAS.includes(c.slug)) as Categoria[]
}

/** Ratings por producto (best-effort: si la vista no existe todavía, devuelve mapa vacío). */
export async function getRatings(
  ids: string[]
): Promise<Map<string, { promedio: number; cantidad: number }>> {
  const map = new Map<string, { promedio: number; cantidad: number }>()
  if (ids.length === 0) return map
  try {
    const { data } = await supabaseAdmin
      .from('producto_ratings')
      .select('producto_id, promedio, cantidad')
      .in('producto_id', ids)
    for (const r of data || []) {
      map.set(r.producto_id, { promedio: Number(r.promedio), cantidad: Number(r.cantidad) })
    }
  } catch {
    // vista aún no creada — sin ratings
  }
  return map
}

/** Ordena y pagina una lista de tarjetas. */
export function ordenarYPaginar(items: CatalogItem[], orden?: string, page?: string) {
  const ordenados = [...items]
  if (orden === 'precio-asc') ordenados.sort((a, b) => a.producto.precio - b.producto.precio)
  else if (orden === 'precio-desc') ordenados.sort((a, b) => b.producto.precio - a.producto.precio)
  else if (orden === 'nombre')
    ordenados.sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es'))

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE))
  const paginaActual = Math.min(Math.max(1, parseInt(page || '1', 10) || 1), totalPaginas)
  const visibles = ordenados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  return { ordenados, visibles, totalPaginas, paginaActual }
}
