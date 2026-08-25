/**
 * Loader de imágenes de Next.
 *
 * Con `loader: 'custom'` el optimizador de Vercel queda fuera del camino: no se
 * gasta ni una transformación (el free tier son 5.000/mes y servir el catálogo
 * una sola vez ya las consume). Las derivadas las generamos nosotros al subir
 * la imagen (ver lib/imagen-derivadas.ts) y acá elegimos cuál corresponde.
 *
 * Cualquier URL que no sea una derivada se devuelve intacta, así las imágenes
 * viejas todavía no migradas y los estáticos de /public siguen funcionando.
 */

/** Debe coincidir con ANCHOS_DERIVADOS de lib/imagen-derivadas.ts */
const ANCHOS = [200, 640, 1280]

/** `.../derivadas/<base>-<ancho>.webp` */
const RE_DERIVADA = /^(.*\/derivadas\/.+)-(\d+)\.webp$/

export default function loaderImagen({ src, width }: { src: string; width: number }) {
  const m = RE_DERIVADA.exec(src)
  if (!m) return src

  // El primer ancho que alcanza; si piden más que el master, el master.
  const elegido = ANCHOS.find(a => a >= width) ?? ANCHOS[ANCHOS.length - 1]
  return `${m[1]}-${elegido}.webp`
}
