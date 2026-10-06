const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

/** Escapa caracteres especiales de HTML para evitar injection en mensajes Telegram con parse_mode HTML */
function escHtml(text: string | undefined | null): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendTelegram(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (err) {
    console.error('[telegram] Error enviando mensaje:', err)
  }
}

/** Escapa para meter texto dentro de un atributo href. */
function escAttr(url: string): string {
  return escHtml(url).replace(/'/g, '&#39;')
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.flowthings.com.ar').replace(/\/$/, '')

export function formatVentaMsg(params: {
  ordenId: string
  total: number
  comprador: { nombre?: string; email?: string; telefono?: string }
  /** `slug` arma el link a la ficha; sin él, el nombre va sin enlazar. */
  items: {
    nombre: string
    cantidad: number
    precio: number
    slug?: string | null
    variante_id?: string | null
  }[]
  envio?: { nombre?: string; costo?: number }
  /** A dónde va el paquete. Vacío cuando es retiro en local. */
  destino?: {
    direccion?: string | null
    piso?: string | null
    departamento?: string | null
    ciudad?: string | null
    provincia?: string | null
    codigo_postal?: string | null
  }
  descuento?: { monto?: number | null; codigo?: string | null }
}): string {
  const { ordenId, total, comprador, items, envio, destino, descuento } = params
  const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

  /**
   * Cada producto enlaza a su ficha: desde el teléfono, saber qué se vendió es
   * abrirlo, no buscarlo. Con variante, el link la deja seleccionada.
   */
  /**
   * Telegram corta el mensaje en 4096 caracteres y devuelve error si se pasa.
   * Un carrito largo con links enlazados llega rápido: se listan los primeros
   * y el resto se cuenta.
   */
  const TOPE_ITEMS = 20
  const visibles = items.slice(0, TOPE_ITEMS)
  const sobran = items.length - visibles.length

  const itemsStr = visibles
    .map(i => {
      const texto = `${escHtml(i.nombre)} x${i.cantidad} — ${pesos(i.precio)}`
      if (!i.slug) return `  • ${texto}`
      const url = `${APP_URL}/productos/${i.slug}${i.variante_id ? `?variante=${i.variante_id}` : ''}`
      return `  • <a href="${escAttr(url)}">${texto}</a>`
    })
    .join('\n') + (sobran > 0 ? `\n  • … y ${sobran} producto${sobran === 1 ? '' : 's'} más` : '')

  const envioStr = envio?.nombre
    ? `🚚 <b>Envío:</b> ${escHtml(envio.nombre)} — ${pesos(envio.costo ?? 0)}\n`
    : ''

  // Dirección completa, en una línea por renglón para que entre en el celular.
  const calle = [destino?.direccion, destino?.piso, destino?.departamento]
    .filter(Boolean)
    .join(' ')
  const localidad = [destino?.ciudad, destino?.provincia].filter(Boolean).join(', ')
  const cp = destino?.codigo_postal ? ` (CP ${escHtml(destino.codigo_postal)})` : ''
  const destinoStr = calle || localidad
    ? `📍 <b>Va a:</b> ${escHtml(calle)}${calle && localidad ? ' — ' : ''}${escHtml(localidad)}${cp}\n`
    : ''

  /**
   * El descuento se informa sólo cuando lo hubo, con el cupón que lo generó: el
   * total solo no explica por qué una venta de $44.100 cobró $15.000.
   */
  const desc = Number(descuento?.monto ?? 0)
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const descuentoStr = desc > 0
    ? `🏷️ <b>Descuento:</b> −${pesos(desc)}${descuento?.codigo ? ` (${escHtml(descuento.codigo)})` : ''}\n` +
      `🧮 <b>Productos:</b> ${pesos(subtotal)}\n`
    : ''

  return (
    `🛍️ <b>¡Nueva venta!</b>\n\n` +
    `📦 <b>Orden:</b> #${ordenId.slice(0, 8).toUpperCase()}\n` +
    `👤 <b>Cliente:</b> ${escHtml(comprador.nombre) || 'Sin nombre'}\n` +
    `📧 <b>Email:</b> ${escHtml(comprador.email) || '-'}\n` +
    `📱 <b>Tel:</b> ${escHtml(comprador.telefono) || '-'}\n` +
    destinoStr +
    envioStr +
    `\n🧾 <b>Productos:</b>\n${itemsStr}\n\n` +
    descuentoStr +
    `💰 <b>Total:</b> ${pesos(total)}`
  )
}
