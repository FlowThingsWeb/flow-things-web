/**
 * Helpers del Meta Pixel para eventos estándar del embudo de compra.
 *
 * NO se importa desde los componentes: para eso está `lib/eventos-compra.ts`,
 * que dispara Meta y GA4 juntos. Llamar a este archivo directo deja el evento
 * en una sola plataforma, que es exactamente el agujero que hubo hasta ahora.
 * Seguros si el pixel no está cargado (no-op). El pixel se inicializa en
 * components/Analytics.tsx solo cuando hay NEXT_PUBLIC_META_PIXEL_ID.
 *
 * Eventos: https://developers.facebook.com/docs/meta-pixel/reference
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fbq(...args: any[]) {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (window as any).fbq
    if (typeof f !== 'function') return false
    try {
      f(...args)
    } catch {
      /* no-op */
    }
    return true
  }
  // En cargas completas, el efecto puede correr antes de que el script del
  // pixel defina window.fbq. Si aún no está, reintentamos un rato corto para
  // no perder el evento (ej. ViewContent al abrir la ficha).
  if (call()) return
  let intentos = 0
  const iv = setInterval(() => {
    intentos++
    if (call() || intentos > 40) clearInterval(iv) // ~10s máximo
  }, 250)
}

/**
 * El id que se le manda a Meta: el SKU.
 *
 * Antes iba `p.id`, el UUID del producto, mientras que el evento Purchase ya
 * mandaba el SKU. Con dos identificadores distintos Meta veía un producto al
 * agregar al carrito y otro al comprar: el embudo no cerraba y el catálogo de
 * Meta no podía emparejar ninguno de los dos eventos con su publicación.
 */
function idMeta(p: { sku?: string | null; id: string }): string {
  const sku = (p.sku ?? '').trim()
  return sku || `sin-sku-${p.id}`
}

/** Vio la ficha de un producto. */
export function trackViewContent(p: { id: string; sku?: string | null; nombre: string; precio: number }) {
  fbq('track', 'ViewContent', {
    content_ids: [idMeta(p)],
    content_name: p.nombre,
    content_type: 'product',
    value: p.precio,
    currency: 'ARS',
  })
}

/** Agregó un producto al carrito. */
export function trackAddToCart(p: {
  id: string
  sku?: string | null
  nombre: string
  precio: number
  cantidad?: number
}) {
  fbq('track', 'AddToCart', {
    content_ids: [idMeta(p)],
    content_name: p.nombre,
    content_type: 'product',
    value: p.precio * (p.cantidad ?? 1),
    currency: 'ARS',
  })
}

/** Arrancó el checkout (fue a pagar). */
export function trackInitiateCheckout(data: { value: number; numItems: number }) {
  fbq('track', 'InitiateCheckout', {
    value: data.value,
    currency: 'ARS',
    num_items: data.numItems,
  })
}
