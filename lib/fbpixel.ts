/**
 * Helpers del Meta Pixel para eventos estándar del embudo de compra.
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

/** Vio la ficha de un producto. */
export function trackViewContent(p: { id: string; nombre: string; precio: number }) {
  fbq('track', 'ViewContent', {
    content_ids: [p.id],
    content_name: p.nombre,
    content_type: 'product',
    value: p.precio,
    currency: 'ARS',
  })
}

/** Agregó un producto al carrito. */
export function trackAddToCart(p: {
  id: string
  nombre: string
  precio: number
  cantidad?: number
}) {
  fbq('track', 'AddToCart', {
    content_ids: [p.id],
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
