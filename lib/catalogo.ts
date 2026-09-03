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
import { logoDeMarca, marcaDe, slugMarca } from '@/lib/marcas'

export const PAGE_SIZE = 24

export type CatalogItem = {
  producto: Producto
  variante: Variante | null
}

export type Categoria = { id: string; nombre: string; slug: string }

export type Subcategoria = {
  id: string
  categoria_id: string
  nombre: string
  slug: string
  orden: number
}

/** Filtros de la grilla, todos opcionales. */
export type Filtros = {
  q?: string
  /** Slug de la subcategoría abierta. */
  sub?: string
  marca?: string
  /** Precio mínimo y máximo, en pesos. */
  min?: number
  max?: number
  /** Sólo lo que tiene stock para entregar ya. */
  disponible?: boolean
  /** Sólo lo que está rebajado. */
  oferta?: boolean
}

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
  const CON_SUB = '*, categorias(id, nombre, slug), subcategorias(id, nombre, slug), variantes(*)'
  const SIN_SUB = '*, categorias(id, nombre, slug), variantes(*)'

  // Hasta que corra supabase_subcategorias.sql la tabla no existe y el select
  // devuelve 400. El catálogo no puede caerse por eso: se reintenta sin las
  // subcategorías y el sitio queda como estaba.
  const consulta = (select: string) =>
    supabaseAdmin
      .from('productos')
      .select(select)
      .eq('activo', true)
      .order('created_at', { ascending: false })

  const { data, error } = await consulta(CON_SUB)
  if (!error) return (data || []) as unknown as Producto[]

  const { data: basico } = await consulta(SIN_SUB)
  return (basico || []) as unknown as Producto[]
}, ['catalogo-completo'], CACHE)

export const getSubcategorias = unstable_cache(async (): Promise<Subcategoria[]> => {
  const { data, error } = await supabaseAdmin
    .from('subcategorias')
    .select('id, categoria_id, nombre, slug, orden')
    .order('orden', { ascending: true })
  // Todavía sin migrar: el menú simplemente no muestra el segundo nivel.
  if (error) return []
  return (data || []) as Subcategoria[]
}, ['subcategorias'], CACHE)

/**
 * Las subcategorías que hoy tienen al menos un producto a la venta.
 *
 * La tabla trae subcategorías sembradas para cuando entre la mercadería
 * —Carpetas, Cuadernos, Mochilas, Útiles escolares—, y el menú del header las
 * estaba ofreciendo igual: cinco opciones en Librería de las cuales cuatro
 * llevaban a una grilla vacía.
 *
 * Es también la lista que decide si una URL de subcategoría existe: una
 * subcategoría sin productos devuelve 404 en vez de una página vacía que
 * Google indexaría como contenido pobre. El día que se le carga el primer
 * producto, aparece sola.
 *
 * El formulario del admin NO usa esta lista: ahí hacen falta todas, porque es
 * justamente donde se le asigna el primer producto a una vacía.
 */
export const getSubcategoriasVisibles = unstable_cache(async (): Promise<Subcategoria[]> => {
  const [subs, productos] = await Promise.all([getSubcategorias(), getCatalogoCompleto()])
  const conProductos = new Set(
    productos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p) => !CATEGORIAS_PAUSADAS.includes((p.categorias as any)?.slug))
      .map((p) => p.subcategoria_id)
      .filter(Boolean),
  )
  return subs.filter((s) => conProductos.has(s.id))
}, ['subcategorias-visibles'], CACHE)

/** Tarjetas de una categoría, SIN aplicar los filtros de la barra lateral. */
export async function getItemsDeCategoria(categoria?: string): Promise<CatalogItem[]> {
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
  return items
}

/** Slug de la subcategoría de un producto, o null si no tiene. */
export function subDe(p: Producto): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((p as any).subcategorias?.slug as string | undefined) ?? null
}

/** ¿Está disponible para entregar ya? */
function hayStock({ producto, variante }: CatalogItem): boolean {
  return (variante ? variante.stock : producto.stock) > 0
}

/**
 * Aplica los filtros de la barra lateral a una lista de tarjetas.
 *
 * Va aparte de la consulta a propósito: la grilla necesita los resultados
 * filtrados, pero los contadores de cada filtro necesitan saber cuántos
 * habría SIN ese filtro puesto. Con la lista completa en memoria las dos
 * cosas salen de la misma llamada.
 */
export function aplicarFiltros(items: CatalogItem[], f: Filtros): CatalogItem[] {
  let out = items

  if (f.sub) out = out.filter(({ producto }) => subDe(producto) === f.sub)
  if (f.marca) out = out.filter(({ producto }) => marcaDe(producto.sku) === f.marca)
  if (f.min != null) out = out.filter(({ producto }) => producto.precio >= f.min!)
  if (f.max != null) out = out.filter(({ producto }) => producto.precio <= f.max!)
  if (f.disponible) out = out.filter(hayStock)
  if (f.oferta) {
    out = out.filter(
      ({ producto }) => producto.precio_anterior != null && producto.precio_anterior > producto.precio
    )
  }

  // Cada tarjeta se filtra sola: la de una variante sólo entra si el término
  // aparece en ESA variante.
  if (f.q?.trim()) {
    const words = normalizar(f.q).split(/\s+/).filter(Boolean)
    out = out.filter(({ producto, variante }) => {
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

  return out
}

/**
 * Cuántos productos quedarían con cada opción de un filtro.
 *
 * Se cuenta aplicando TODOS los filtros menos el propio: si estoy mirando
 * "Peluches" y quiero ver las marcas, cada marca tiene que decir cuántos
 * peluches tiene, no cuántos productos tiene en todo el catálogo. Y una
 * opción que daría cero no se ofrece: nada peor que un filtro que lleva a
 * una grilla vacía.
 */
export function contarPor(
  items: CatalogItem[],
  f: Filtros,
  campo: 'sub' | 'marca',
): Map<string, number> {
  const base = aplicarFiltros(items, { ...f, [campo]: undefined })
  const cuenta = new Map<string, number>()
  const vistos = new Set<string>()
  for (const it of base) {
    const clave = campo === 'sub' ? subDe(it.producto) : marcaDe(it.producto.sku)
    if (!clave) continue
    // Un producto con cinco variantes es un producto, no cinco.
    const id = `${clave}::${it.producto.id}`
    if (vistos.has(id)) continue
    vistos.add(id)
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
  }
  return cuenta
}

/** Compatibilidad: categoría + búsqueda, que es lo que usaban las páginas. */
export async function getProductos(categoria?: string, q?: string): Promise<CatalogItem[]> {
  return aplicarFiltros(await getItemsDeCategoria(categoria), { q })
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

export type MarcaCatalogo = {
  nombre: string
  slug: string
  logo: string | null
  /** Cuántos productos distintos tiene, no cuántas tarjetas. */
  cantidad: number
  /** Una foto de su mercadería, para las marcas que no tienen logo. */
  foto: string | null
}

/**
 * Las marcas que hoy tienen algo a la venta, con su logo y cuántos productos.
 *
 * Sale del SKU, que ya estaba mapeado para el feed de Merchant Center: no hay
 * tabla de marcas ni un campo que alguien tenga que completar al cargar un
 * producto. La contra es que un SKU que no está en el mapa cae en "Flow
 * Things", y esa no es una marca para mostrar en la pared de logos — se
 * excluye.
 */
export const getMarcas = unstable_cache(async (): Promise<MarcaCatalogo[]> => {
  const productos = await getCatalogoCompleto()
  const porMarca = new Map<string, { cantidad: number; foto: string | null }>()

  for (const p of productos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (CATEGORIAS_PAUSADAS.includes((p.categorias as any)?.slug)) continue
    const nombre = marcaDe(p.sku)
    if (nombre === 'Flow Things') continue
    const previo = porMarca.get(nombre)
    const foto =
      p.imagen_url ||
      p.imagenes?.[0] ||
      (p.variantes || []).find((v) => v.activo && (v.imagen_url || v.imagenes?.[0]))?.imagen_url ||
      null
    porMarca.set(nombre, {
      cantidad: (previo?.cantidad ?? 0) + 1,
      foto: previo?.foto ?? foto,
    })
  }

  return [...porMarca.entries()]
    .map(([nombre, d]) => ({
      nombre,
      slug: slugMarca(nombre),
      logo: logoDeMarca(nombre),
      cantidad: d.cantidad,
      foto: d.foto,
    }))
    // Primero las que más tienen: la pared de logos abre con lo que más hay.
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'))
}, ['marcas-catalogo'], CACHE)

/** Tarjetas de una marca, por su slug. */
export async function getItemsDeMarca(slug: string): Promise<CatalogItem[]> {
  const todos = await getItemsDeCategoria()
  return todos.filter(({ producto }) => slugMarca(marcaDe(producto.sku)) === slug)
}
