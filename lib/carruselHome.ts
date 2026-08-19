import { Producto } from '@/types'

/**
 * Selección de productos del carrusel de la home.
 *
 * Junta destacados + ofertas + novedades en una sola tanda y rota parte de
 * ella cada pocos días, para que quien vuelve a la semana siguiente no se
 * encuentre exactamente lo mismo.
 *
 * La rotación es determinística, no aleatoria: el "período" sale de la fecha,
 * así que dentro de esos días todas las visitas ven lo mismo. Si fuese random
 * por request, el carrusel cambiaría entre recargas y sería imposible volver
 * a encontrar un producto que viste hace un minuto.
 */

/** Cada cuántos días se renueva la tanda rotativa. */
export const DIAS_POR_ROTACION = 3

/** Cuántos productos entran al carrusel. */
export const CUPO_CARRUSEL = 12

/**
 * Tope de lugares fijos. Destacados y ofertas son los que curás a mano, así
 * que se quedan; el resto de los lugares son los que rotan. Sin este tope, un
 * día con muchas ofertas dejaría al carrusel sin nada que rotar.
 */
const CUPO_FIJOS = 6

export type EtiquetaCarrusel = 'oferta' | 'destacado' | 'novedad'

export type SlideCarrusel = {
  producto: Producto
  etiqueta: EtiquetaCarrusel
  /** % de descuento, solo cuando la etiqueta es 'oferta'. */
  descuento: number | null
}

/** PRNG chico y determinístico (mulberry32). Misma semilla, mismo orden. */
function prng(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Número de período actual: cambia cada DIAS_POR_ROTACION días. */
export function periodoActual(ahora = new Date()): number {
  const MS_POR_DIA = 86_400_000
  return Math.floor(ahora.getTime() / (DIAS_POR_ROTACION * MS_POR_DIA))
}

function esOferta(p: Producto): boolean {
  return Boolean(p.precio_anterior && p.precio_anterior > p.precio)
}

function porcentajeDescuento(p: Producto): number {
  if (!esOferta(p)) return 0
  return Math.round(((p.precio_anterior! - p.precio) / p.precio_anterior!) * 100)
}

/** Mezcla determinística: mismo array + misma semilla ⇒ mismo resultado. */
function mezclarConSemilla<T>(items: T[], semilla: number): T[] {
  const rnd = prng(semilla)
  return items
    .map((item) => ({ item, orden: rnd() }))
    .sort((a, b) => a.orden - b.orden)
    .map(({ item }) => item)
}

/**
 * Arma los slides del carrusel a partir de todos los productos publicables.
 *
 * @param productos  Activos, sin categorías pausadas. Los sin stock se
 *                   descartan acá: el carrusel es para comprar, mostrar algo
 *                   agotado arriba de todo es la peor primera impresión.
 */
export function armarCarrusel(
  productos: Producto[],
  ahora = new Date(),
): SlideCarrusel[] {
  const disponibles = productos.filter((p) => (p.stock ?? 0) > 0)
  if (disponibles.length === 0) return []

  const semilla = periodoActual(ahora)

  // Fijos: ofertas primero (el descuento es el mejor gancho), y de mayor a
  // menor descuento. Después los destacados, mezclados por período para que
  // al menos cambien de orden.
  const ofertas = disponibles
    .filter(esOferta)
    .sort((a, b) => porcentajeDescuento(b) - porcentajeDescuento(a))

  const yaElegidos = new Set(ofertas.map((p) => p.id))

  const destacados = mezclarConSemilla(
    disponibles.filter((p) => p.destacado && !yaElegidos.has(p.id)),
    semilla,
  )
  for (const p of destacados) yaElegidos.add(p.id)

  const fijos = [...ofertas, ...destacados].slice(0, CUPO_FIJOS)
  const idsFijos = new Set(fijos.map((p) => p.id))

  // Rotativos: todo el resto, mezclado por período. Al cambiar el período
  // cambia la mezcla y entran otros productos en los lugares libres.
  const rotativos = mezclarConSemilla(
    disponibles.filter((p) => !idsFijos.has(p.id)),
    semilla,
  ).slice(0, Math.max(0, CUPO_CARRUSEL - fijos.length))

  return [...fijos, ...rotativos].map((producto) => {
    if (esOferta(producto)) {
      return {
        producto,
        etiqueta: 'oferta' as const,
        descuento: porcentajeDescuento(producto),
      }
    }
    return {
      producto,
      etiqueta: producto.destacado
        ? ('destacado' as const)
        : ('novedad' as const),
      descuento: null,
    }
  })
}
