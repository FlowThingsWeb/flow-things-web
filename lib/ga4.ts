/**
 * Eventos de ecommerce de GA4.
 *
 * Hasta ahora la tienda sólo disparaba `purchase`. Con eso GA4 sabe cuándo
 * alguien compra y nada más: no hay forma de ver dónde se cae el resto. Con 77
 * "agregar al carrito" en Meta y cero compras, la pregunta era en qué paso se
 * pierde la gente — y no se podía contestar, porque los pasos no existían.
 *
 * Los `item_id` van con el SKU, igual que en `purchase`. Si acá fuera el UUID
 * del producto y allá el SKU, GA4 los trataría como productos distintos y el
 * embudo no cerraría con la venta: se vería gente agregando una cosa y
 * comprando otra.
 */

export type ItemGA4 = {
  item_id: string
  item_name: string
  price: number
  quantity: number
}

/** El id que espera GA4: el SKU, y sólo si no hay, algo estable derivado del producto. */
export function idGA4(p: { sku?: string | null; id: string }): string {
  const sku = (p.sku ?? '').trim()
  return sku || `sin-sku-${p.id}`
}

/**
 * Manda el evento sin romper si gtag todavía no cargó.
 *
 * El script de GA4 entra con `lazyOnload`, así que puede no estar definido
 * cuando el usuario hace click rápido. Se reintenta un rato corto en vez de
 * perder el evento — mismo criterio que ya usaba el pixel de Meta.
 */
function gtag(evento: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const intentar = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag
    if (typeof g !== 'function') return false
    try {
      g('event', evento, params)
    } catch {
      /* que un evento de medición no rompa la tienda */
    }
    return true
  }
  if (intentar()) return
  let intentos = 0
  const iv = setInterval(() => {
    intentos++
    if (intentar() || intentos > 40) clearInterval(iv) // ~10 s
  }, 250)
}

const ARS = 'ARS'

/** Vio la ficha de un producto. */
export function gaViewItem(p: { id: string; sku?: string | null; nombre: string; precio: number }) {
  gtag('view_item', {
    currency: ARS,
    value: p.precio,
    items: [{ item_id: idGA4(p), item_name: p.nombre, price: p.precio, quantity: 1 }],
  })
}

/** Agregó un producto al carrito. */
export function gaAddToCart(p: {
  id: string
  sku?: string | null
  nombre: string
  precio: number
  cantidad?: number
}) {
  const cantidad = p.cantidad ?? 1
  gtag('add_to_cart', {
    currency: ARS,
    value: p.precio * cantidad,
    items: [{ item_id: idGA4(p), item_name: p.nombre, price: p.precio, quantity: cantidad }],
  })
}

/** Sacó un producto del carrito. Dice qué se arrepiente de llevar. */
export function gaRemoveFromCart(p: {
  id: string
  sku?: string | null
  nombre: string
  precio: number
  cantidad?: number
}) {
  const cantidad = p.cantidad ?? 1
  gtag('remove_from_cart', {
    currency: ARS,
    value: p.precio * cantidad,
    items: [{ item_id: idGA4(p), item_name: p.nombre, price: p.precio, quantity: cantidad }],
  })
}

/** Abrió el carrito. Es el paso entre agregar y pagar, donde se ve el envío. */
export function gaViewCart(d: { total: number; items: ItemGA4[] }) {
  gtag('view_cart', { currency: ARS, value: d.total, items: d.items })
}

/** Apretó "finalizar compra". Es el paso que separa "no me convenció" de "se rompió". */
export function gaBeginCheckout(d: { total: number; items: ItemGA4[] }) {
  gtag('begin_checkout', { currency: ARS, value: d.total, items: d.items })
}
