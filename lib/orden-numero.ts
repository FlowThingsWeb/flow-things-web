/**
 * Cómo se llama un pedido, en un solo lugar.
 *
 * El número de pedido de la tienda ES el número de venta del CRM. No hay
 * dos numeraciones: lo que el cliente ve en el mail, lo que vos ves en
 * /admin/ordenes y lo que figura en el CRM como "venta #314" son el mismo
 * número. Eso lo hace posible que el número lo asigne el CRM —su secuencia
 * es compartida con Mercado Libre, así que la tienda no puede adivinar cuál
 * sigue— y lo devuelva al informar la venta.
 *
 * Hay una ventana donde el número todavía no existe: entre que el pago se
 * aprueba y que la cola de jobs le avisa al CRM pasan unos 30 a 60 segundos.
 * Y hay órdenes que no van a tener número nunca —las rechazadas, las que
 * quedaron en 'pending'—, porque no son ventas. Para esas se muestra el
 * código corto del UUID, que es lo que se mostraba antes de todo esto.
 *
 * El código corto va en MAYÚSCULA y el número pelado, sin ceros a la
 * izquierda: "#314" se dicta por teléfono y "#BC28C084" se lee de una
 * pantalla, que es exactamente la diferencia entre los dos casos.
 */

/** Lo mínimo que hace falta para nombrar un pedido. */
export type OrdenIdentificable = {
  id: string
  numero?: number | null
}

/** Los primeros ocho del UUID, en mayúscula. El identificador de respaldo. */
export function codigoCortoOrden(id: string): string {
  return String(id ?? '').slice(0, 8).toUpperCase()
}

/**
 * El identificador del pedido, sin el `#`.
 *
 * Se devuelve pelado porque casi todos los lugares que lo usan ya escriben
 * el `#` ellos —las plantillas de mail dicen `PEDIDO #{{orden_id}}`—, y
 * terminar con "##314" es la clase de detalle que llega al cliente.
 */
export function numeroOrden(orden: OrdenIdentificable): string {
  const n = orden.numero
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return String(n)
  return codigoCortoOrden(orden.id)
}

/** Lo mismo con el `#` adelante, para pegar directo en pantalla. */
export function etiquetaOrden(orden: OrdenIdentificable): string {
  return `#${numeroOrden(orden)}`
}

/**
 * True si el pedido todavía no tiene su número del CRM.
 *
 * Sirve para que el admin pueda distinguir "esta venta no llegó al CRM" de
 * "esta orden nunca se aprobó": lo primero es un problema que hay que
 * mirar, lo segundo es el funcionamiento normal.
 */
export function sinNumeroDelCRM(orden: OrdenIdentificable): boolean {
  const n = orden.numero
  return !(typeof n === 'number' && Number.isFinite(n) && n > 0)
}
