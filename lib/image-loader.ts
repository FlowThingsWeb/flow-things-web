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
import { derivada } from './derivadas-url'

export default function loaderImagen({ src, width }: { src: string; width: number }) {
  return derivada(src, width)
}
