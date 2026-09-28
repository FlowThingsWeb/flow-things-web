import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, escapeHtml, filaProducto } from '@/lib/email'
import { armarMailCarrito } from '@/lib/carrito-abandonado'
import type { EtapaCarrito } from '@/lib/email-constants'
import { formatMonto } from '@/lib/format'

/**
 * Qué etapa le toca a una orden pendiente según hace cuánto se creó.
 *
 * Esta lista es la única de las tres que manda un solo mail por orden, así que
 * no arrastra una secuencia: elige de una la etapa más avanzada que ya venció,
 * igual que hacen las otras dos cuando encuentran algo viejo sin avisar.
 */
export function etapaPorAntiguedad(creadaEn: string, ahora = Date.now()): EtapaCarrito {
  const horas = (ahora - new Date(creadaEn).getTime()) / 3600_000
  if (horas >= 24 * 7) return '7d'
  if (horas >= 24) return '24h'
  return '2h'
}

/**
 * Envía el mail de "terminá tu compra" a una orden que quedó pendiente (el
 * comprador llegó al checkout y dejó su email pero no pagó). Incluye invitados
 * (sin cuenta). Marca recordatorio_carrito_at para no repetir. El link lleva a
 * /retomar/<id>, que vuelve a cargar los productos en el carrito.
 *
 * El cuerpo lo arma `armarMailCarrito`, igual que las otras dos listas. Esto
 * antes llenaba la plantilla por su cuenta con tres huecos de los ocho que
 * tiene, y los otros cinco le llegaron al comprador escritos como `{{titulo}}`.
 */
export async function enviarRecordatorioCheckout(
  ordenId: string,
  etapaForzada?: EtapaCarrito,
): Promise<{ ok: boolean; error?: string }> {
  const { data: orden } = await supabaseAdmin
    .from('ordenes')
    .select('id, estado, items, datos_comprador, created_at')
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

  const etapa = etapaForzada ?? etapaPorAntiguedad(orden.created_at)
  const { asunto, cuerpo } = armarMailCarrito(
    etapa, nombre, productosLista, `${appUrl}/retomar/${ordenId}`,
  )

  try {
    await sendEmail({ to: email, asunto, cuerpo })
    await supabaseAdmin
      .from('ordenes')
      .update({ recordatorio_carrito_at: new Date().toISOString() })
      .eq('id', ordenId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al enviar.' }
  }
}
