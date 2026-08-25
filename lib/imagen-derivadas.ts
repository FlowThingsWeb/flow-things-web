/**
 * Derivadas de imagen propias, en vez del optimizador de Vercel.
 *
 * Vercel cobra una "transformación" por cada combinación única de
 * (imagen, ancho, calidad, formato) y el free tier son 5.000 por mes. El
 * catálogo tiene ~1.100 imágenes distintas: servirlo una sola vez en dos
 * anchos y dos formatos (webp para browsers, jpeg para bots que no mandan
 * `Accept: image/webp`) ya agota la cuota, y a partir de ahí las imágenes
 * empiezan a fallar.
 *
 * En lugar de eso generamos nosotros los anchos al subir, los guardamos en
 * Supabase y los servimos derecho. Cero transformaciones, para siempre.
 */
import sharp from 'sharp'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Anchos que generamos. Cubren todo lo que el sitio pide de verdad:
 *  - 200: miniaturas (carrito, drawer, galería, admin: 36-128px, incluso en DPR2)
 *  - 640: grilla del catálogo y ficha en mobile a 100vw
 *  - 1280: ficha en desktop a 50vw con DPR2, y el lightbox (max-w-4xl = 896px)
 * Sumar un ancho más multiplica el storage sin que se note en pantalla.
 */
export const ANCHOS_DERIVADOS = [200, 640, 1280] as const

/** El ancho más grande hace de "master": es la URL que guardamos en la DB. */
export const ANCHO_MASTER = ANCHOS_DERIVADOS[ANCHOS_DERIVADOS.length - 1]

/** Carpeta dentro del bucket `productos` donde viven las derivadas. */
export const CARPETA_DERIVADAS = 'derivadas'

export const BUCKET = 'productos'

/** Calidad webp. 80 es el punto donde deja de notarse la diferencia. */
const CALIDAD_WEBP = 80

/**
 * Genera las derivadas de un buffer y las sube a Supabase.
 *
 * `base` es el nombre sin extensión; las derivadas quedan como
 * `derivadas/<base>-<ancho>.webp`. Devuelve la URL pública del master.
 */
export async function generarYSubirDerivadas(
  buffer: Buffer,
  base: string
): Promise<{ url: string; paths: string[] }> {
  const meta = await sharp(buffer).metadata()
  const anchoOriginal = meta.width ?? ANCHO_MASTER
  const paths: string[] = []

  for (const ancho of ANCHOS_DERIVADOS) {
    // No agrandamos: si el original es más chico, se guarda tal cual.
    const destino = sharp(buffer).rotate()
    if (anchoOriginal > ancho) destino.resize({ width: ancho })

    const salida = await destino.webp({ quality: CALIDAD_WEBP }).toBuffer()
    const path = `${CARPETA_DERIVADAS}/${base}-${ancho}.webp`

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, salida, { contentType: 'image/webp', upsert: true })

    if (error) throw new Error(`No se pudo subir ${path}: ${error.message}`)
    paths.push(path)
  }

  const { data } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(`${CARPETA_DERIVADAS}/${base}-${ANCHO_MASTER}.webp`)

  return { url: data.publicUrl, paths }
}
