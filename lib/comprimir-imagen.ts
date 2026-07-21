/**
 * Compresión de imágenes en el navegador, antes de subirlas.
 *
 * Las fotos que salen del celular pesan 3-8 MB y vienen en 4000px de ancho,
 * cuando la web nunca las muestra a más de ~1200px. Subirlas tal cual llena
 * el storage y hace que cada transformación de Vercel parta de un original
 * enorme. Redimensionamos y pasamos a webp antes de subir.
 *
 * Es best-effort: ante cualquier problema devolvemos el archivo original,
 * así una foto rara nunca rompe la carga de un producto.
 */

/** Lado máximo (px). La ficha muestra como mucho ~1200px; 1600 da margen para zoom. */
const MAX_LADO = 1600
/** Calidad webp. 0.82 es visualmente indistinguible y pesa mucho menos. */
const CALIDAD = 0.82

export type ResultadoCompresion = {
  archivo: File
  /** true si efectivamente se comprimió (false = se dejó el original). */
  comprimido: boolean
  bytesAntes: number
  bytesDespues: number
}

export async function comprimirImagen(file: File): Promise<ResultadoCompresion> {
  const sinCambios: ResultadoCompresion = {
    archivo: file,
    comprimido: false,
    bytesAntes: file.size,
    bytesDespues: file.size,
  }

  // Los GIF pueden ser animados y el canvas se quedaría solo con el primer
  // cuadro. Mejor no tocarlos.
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return sinCambios
  }
  // createImageBitmap/canvas sólo existen en el browser
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return sinCambios
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Formato que el browser no puede decodificar: lo subimos tal cual
    return sinCambios
  }

  try {
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * escala))
    const h = Math.max(1, Math.round(bitmap.height * escala))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return sinCambios
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', CALIDAD),
    )
    if (!blob) return sinCambios

    // Si el "optimizado" no achica nada (imágenes ya chicas o muy optimizadas),
    // nos quedamos con el original.
    if (blob.size >= file.size) return sinCambios

    const nombre = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return {
      archivo: new File([blob], nombre, { type: 'image/webp' }),
      comprimido: true,
      bytesAntes: file.size,
      bytesDespues: blob.size,
    }
  } catch {
    return sinCambios
  } finally {
    bitmap.close()
  }
}

/** "2,4 MB" — para mostrarle al admin cuánto se ahorró. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
