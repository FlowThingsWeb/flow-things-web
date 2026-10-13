import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Un carrito que es exactamente lo que la persona ya compró no está abandonado.
 *
 * El carrito guardado no se vacía solo al pagar. `clearCart()` corre en /exito
 * y sólo si el comprador vuelve desde Mercado Pago y se queda hasta que el
 * poll confirma la orden: el que paga en el celular y cierra la pestaña nunca
 * pasa por ahí. Peor todavía, el re-sync de CartSync vuelve a escribir la fila
 * con `updated_at = ahora` y las tres etapas en null, así que la secuencia de
 * recordatorios arranca de cero por algo que ya está pago.
 *
 * El chequeo que había comparaba fechas —compró después de tocar el carrito—
 * y eso no alcanza justamente cuando el carrito se reescribe después de la
 * compra. Caso real: una orden aprobada 13:59:29, el carrito regrabado a las
 * 14:00:58 con el mismo ítem, y el mail de "te quedó algo pendiente" saliendo
 * a las 16:23.
 *
 * Por eso acá se compara CONTENIDO y no tiempo: mismos productos, mismas
 * variantes, mismas cantidades. Si coincide con una compra aprobada de esa
 * persona, no se le escribe y no aparece en el panel.
 */

/** Clave de una línea: producto, variante y cantidad. */
function linea(productoId: unknown, varianteId: unknown, cantidad: unknown): string {
  const p = String(productoId ?? '')
  const v = varianteId == null || varianteId === '' ? '' : String(varianteId)
  const c = Number(cantidad) || 1
  return `${p}::${v}::${c}`
}

/**
 * Firma de un carrito guardado o de un checkout en progreso.
 *
 * Se ordena para que el orden en que se agregaron las cosas no cambie la
 * firma: el mismo carrito armado al revés tiene que dar lo mismo.
 */
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

export type FirmasCompradas = {
  /** Firmas de lo que compró cada usuario logueado. */
  porUser: Map<string, Set<string>>
  /**
   * Lo mismo por email, en minúsculas.
   *
   * Una compra hecha sin sesión no queda atada a la cuenta aunque sea la
   * misma persona, y el checkout en progreso sólo conoce el mail.
   */
  porEmail: Map<string, Set<string>>
}

/**
 * Trae las firmas de todas las compras aprobadas, para chequear de a muchos
 * carritos sin una consulta por cada uno.
 */
export async function cargarFirmasCompradas(): Promise<FirmasCompradas> {
  const porUser = new Map<string, Set<string>>()
  const porEmail = new Map<string, Set<string>>()

  const { data: ordenes } = await supabaseAdmin
    .from('ordenes')
    .select('user_id, items, datos_comprador')
    .eq('estado', 'approved')

  const sumar = (mapa: Map<string, Set<string>>, clave: string | null | undefined, firma: string) => {
    if (!clave || !firma) return
    const set = mapa.get(clave)
    if (set) set.add(firma)
    else mapa.set(clave, new Set([firma]))
  }

  for (const o of ordenes || []) {
    const f = firmaOrden(o.items)
    if (!f) continue
    sumar(porUser, o.user_id, f)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sumar(porEmail, (o.datos_comprador as any)?.email?.toLowerCase(), f)
  }

  return { porUser, porEmail }
}

/**
 * ¿Este carrito es exactamente una compra que la persona ya hizo?
 *
 * Exacto a propósito: si agregó una unidad más o sumó otro producto, es una
 * intención nueva y el recordatorio corresponde. Lo que no corresponde es
 * insistir con lo que ya está pago.
 */
export function esCompraYaHecha(
  firmas: FirmasCompradas,
  items: unknown,
  opts: { userId?: string | null; email?: string | null },
): boolean {
  const f = firmaCarrito(items)
  if (!f) return false
  if (opts.userId && firmas.porUser.get(opts.userId)?.has(f)) return true
  if (opts.email && firmas.porEmail.get(opts.email.toLowerCase())?.has(f)) return true
  return false
}
