/**
 * Las URLs de las derivadas, sin tocar el storage.
 *
 * Al subir una imagen se generan tres anchos (lib/imagen-derivadas.ts) y la
 * base de datos guarda la URL del más grande. Cualquier `<img>` que use esa
 * URL tal cual se baja 1280 px de ancho, aunque lo muestre del tamaño de una
 * moneda: el banner de la home mandaba 2,2 MB de fotos a un celular por eso.
 *
 * Esto arma el `srcset` con los tres anchos para que el browser elija el que
 * corresponde al hueco. Lo usa `next/image` por su loader y cualquier `<img>`
 * suelto que no pase por ahí.
 */

/** Debe coincidir con ANCHOS_DERIVADOS de lib/imagen-derivadas.ts */
export const ANCHOS = [200, 640, 1280]

/** `.../derivadas/<base>-<ancho>.webp` */
export const RE_DERIVADA = /^(.*\/derivadas\/.+)-(\d+)\.webp$/

/**
 * La misma imagen en otro ancho. Devuelve la URL intacta si no es una
 * derivada: las imágenes viejas sin migrar y los estáticos de /public siguen
 * funcionando.
 */
export function derivada(src: string, ancho: number): string {
  const m = RE_DERIVADA.exec(src)
  if (!m) return src
  const elegido = ANCHOS.find((a) => a >= ancho) ?? ANCHOS[ANCHOS.length - 1]
  return `${m[1]}-${elegido}.webp`
}

/**
 * El `srcset` con los tres anchos, o `undefined` si la URL no es una derivada
 * (un `srcset` vacío rompe la imagen, así que no se pone ninguno).
 */
export function srcSetDerivadas(src: string): string | undefined {
  const m = RE_DERIVADA.exec(src)
  if (!m) return undefined
  return ANCHOS.map((a) => `${m[1]}-${a}.webp ${a}w`).join(', ')
}
