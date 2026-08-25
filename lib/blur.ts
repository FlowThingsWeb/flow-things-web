/**
 * Placeholders difuminados de las imágenes de producto.
 *
 * Cada blur es un webp de 12px en base64 (~200 bytes) que viaja dentro del
 * HTML, así la tarjeta muestra la forma y el color del producto desde el
 * primer frame en vez de un rectángulo gris. El mapa completo lo genera
 * scripts/generar-blur.mjs y vive en `derivadas/blur.json`.
 *
 * Se lee una vez por hora y queda cacheado: son ~300 KB que nunca llegan al
 * browser, porque cada página inyecta sólo los blurs de lo que muestra.
 */
import { Producto, Variante } from '@/types'

const URL_BLUR = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/derivadas/blur.json`

export type MapaBlur = Record<string, string>

export async function getMapaBlur(): Promise<MapaBlur> {
  try {
    const r = await fetch(URL_BLUR, { next: { revalidate: 3600 } })
    if (!r.ok) return {}
    return (await r.json()) as MapaBlur
  } catch {
    // Sin mapa las imágenes cargan igual, sólo que sin difuminado previo.
    return {}
  }
}

/**
 * Imagen que muestra una tarjeta de producto, en cascada: variante propia →
 * galería de la variante → imagen del producto → su galería → imagen de
 * alguna variante. Vive acá para que el server elija el mismo blur que la
 * tarjeta va a terminar mostrando.
 */
export function imagenDeProducto(
  producto: Producto,
  variante?: Variante | null
): string | null {
  const varianteConImagen = producto.variantes?.find(
    (v) => v.activo !== false && (v.imagen_url || v.imagenes?.[0])
  )
  return (
    variante?.imagen_url ||
    variante?.imagenes?.[0] ||
    producto.imagen_url ||
    producto.imagenes?.[0] ||
    varianteConImagen?.imagen_url ||
    varianteConImagen?.imagenes?.[0] ||
    null
  )
}

/** `.../derivadas/1785-abc-1280.webp` → el blur de `1785-abc`, si existe. */
export function blurDe(mapa: MapaBlur, url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const m = /\/derivadas\/(.+)-\d+\.webp$/.exec(url)
  return m ? mapa[m[1]] : undefined
}
