/**
 * Firma canónica de un carrito o de una orden, para compararlos por contenido.
 *
 * Vive aparte de `compra-identica.ts` porque esto lo usa también el navegador
 * (CartSync) y ese módulo importa `supabaseAdmin`, que no puede terminar en el
 * bundle del cliente.
 *
 * Mismos productos, mismas variantes, mismas cantidades. Se ordena para que el
 * orden en que se agregaron las cosas no cambie el resultado: el mismo carrito
 * armado al revés tiene que dar la misma firma.
 */

/** Clave de una línea: producto, variante y cantidad. */
function linea(productoId: unknown, varianteId: unknown, cantidad: unknown): string {
  const p = String(productoId ?? '')
  const v = varianteId == null || varianteId === '' ? '' : String(varianteId)
  const c = Number(cantidad) || 1
  return `${p}::${v}::${c}`
}

/** Firma de un carrito guardado o de un checkout en progreso. */
export function firmaCarrito(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return ''
  return items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => linea(i?.producto?.id ?? i?.id, i?.varianteId ?? i?.variante_id, i?.cantidad))
    .sort()
    .join('|')
}

/** Firma de los ítems de una orden. Misma forma canónica que `firmaCarrito`. */
export function firmaOrden(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return ''
  return items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => linea(i?.id, i?.variante_id, i?.cantidad))
    .sort()
    .join('|')
}
