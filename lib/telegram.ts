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

export function formatVentaMsg(params: {
  ordenId: string
  total: number
  comprador: { nombre?: string; email?: string; telefono?: string }
  items: { nombre: string; cantidad: number; precio: number }[]
  envio?: { nombre?: string; costo?: number }
}): string {
  const { ordenId, total, comprador, items, envio } = params

  const itemsStr = items
    .map(i => `  • ${escHtml(i.nombre)} x${i.cantidad} — $${i.precio.toLocaleString('es-AR')}`)
    .join('\n')

  const envioStr =
    envio?.nombre
      ? `\n🚚 <b>Envío:</b> ${escHtml(envio.nombre)} — $${(envio.costo ?? 0).toLocaleString('es-AR')}`
      : ''

  return (
    `🛍️ <b>¡Nueva venta!</b>\n\n` +
    `📦 <b>Orden:</b> #${ordenId.slice(0, 8).toUpperCase()}\n` +
    `👤 <b>Cliente:</b> ${escHtml(comprador.nombre) || 'Sin nombre'}\n` +
    `📧 <b>Email:</b> ${escHtml(comprador.email) || '-'}\n` +
    `📱 <b>Tel:</b> ${escHtml(comprador.telefono) || '-'}\n` +
    `${envioStr}\n\n` +
    `🧾 <b>Productos:</b>\n${itemsStr}\n\n` +
    `💰 <b>Total:</b> $${total.toLocaleString('es-AR')}`
  )
}
