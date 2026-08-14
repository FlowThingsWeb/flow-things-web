import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, renderTemplate, escapeHtml, filaProducto } from '@/lib/email'
import { DEFAULT_CARRITO_ASUNTO, DEFAULT_CARRITO_CUERPO } from '@/lib/email-constants'
import { formatMonto } from '@/lib/format'

/**
 * Envía el mail de "terminá tu compra" a una orden que quedó pendiente (el
 * comprador llegó al checkout y dejó su email pero no pagó). Incluye invitados
 * (sin cuenta). Marca recordatorio_carrito_at para no repetir. El link lleva a
 * /retomar/<id>, que vuelve a cargar los productos en el carrito.
 */
export async function enviarRecordatorioCheckout(
  ordenId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: orden } = await supabaseAdmin
    .from('ordenes')
    .select('id, estado, items, datos_comprador')
    .eq('id', ordenId)
    .maybeSingle()

  if (!orden) return { ok: false, error: 'La orden no existe.' }
  if (orden.estado !== 'pending') return { ok: false, error: 'La orden no está pendiente.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comprador: any = orden.datos_comprador ?? {}
  const email: string | undefined = comprador.email
  if (!email) return { ok: false, error: 'La orden no tiene email.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(orden.items) ? orden.items : []
  if (items.length === 0) return { ok: false, error: 'La orden no tiene ítems.' }

  const nombre = comprador.nombre || String(email).split('@')[0] || 'Hola'
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

  const filas = items.map((it) => {
    const n = escapeHtml(String(it?.nombre ?? 'Producto'))
    const cant = Number(it?.cantidad) || 1
    const precio = Number(it?.precio ?? 0)
    return filaProducto(it?.imagen_url, n, cant, formatMonto(precio * cant), appUrl)
  }).join('')
  const productosLista = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${filas}</table>`

  const cuerpo = renderTemplate(DEFAULT_CARRITO_CUERPO, {
    nombre: escapeHtml(nombre),
    productos_lista: productosLista,
    link: `${appUrl}/retomar/${ordenId}`,
  })

  try {
    await sendEmail({ to: email, asunto: DEFAULT_CARRITO_ASUNTO, cuerpo })
    await supabaseAdmin
      .from('ordenes')
      .update({ recordatorio_carrito_at: new Date().toISOString() })
      .eq('id', ordenId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al enviar.' }
  }
}
