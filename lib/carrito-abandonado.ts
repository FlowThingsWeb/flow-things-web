import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, renderTemplate, escapeHtml, filaProducto } from '@/lib/email'
import {
  BLOQUE_CUPON_CARRITO, CARRITO_ETAPAS, DEFAULT_CARRITO_CUERPO, type EtapaCarrito,
} from '@/lib/email-constants'
import { formatMonto } from '@/lib/format'

/**
 * Asunto y cuerpo del recordatorio de carrito para una etapa.
 *
 * Lo comparten el cron y el envío manual del admin: si el copy de una etapa
 * cambia, cambia en los dos lados. El cupón sólo entra en la de la semana.
 */
export function armarMailCarrito(
  etapa: EtapaCarrito,
  nombre: string,
  productosLista: string,
  link: string,
): { asunto: string; cuerpo: string } {
  const e = CARRITO_ETAPAS[etapa]
  const nombreSeguro = escapeHtml(nombre)
  return {
    asunto: e.asunto,
    cuerpo: renderTemplate(DEFAULT_CARRITO_CUERPO, {
      nombre: nombreSeguro,
      titulo: e.titulo.replace('{{nombre}}', nombreSeguro),
      bajada: e.bajada,
      cta: e.cta,
      emoji: e.emoji,
      productos_lista: productosLista,
      bloque_extra: e.conCupon ? BLOQUE_CUPON_CARRITO : '',
      link,
    }),
  }
}

/**
 * Arma y envía el email de recuperación de carrito abandonado a un usuario.
 * Marca recordatorio_enviado. Se usa desde el admin (envío manual) — el cron
 * tiene su propio loop batcheado y su propia secuencia de etapas.
 */
export async function enviarRecordatorioCarrito(
  userId: string,
  etapa: EtapaCarrito = '2h',
): Promise<{ ok: boolean; error?: string }> {
  const { data: c } = await supabaseAdmin
    .from('carritos_guardados')
    .select('items')
    .eq('user_id', userId)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(c?.items) ? c!.items : []
  if (items.length === 0) return { ok: false, error: 'El carrito está vacío.' }

  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = userRes?.user?.email
  if (!email) return { ok: false, error: 'El usuario no tiene email.' }

  const { data: perfil } = await supabaseAdmin
    .from('perfiles').select('nombre').eq('user_id', userId).single()
  const nombre = perfil?.nombre || email.split('@')[0] || 'Hola'

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')
  const filas = items.map((it) => {
    const n = escapeHtml(String(it?.producto?.nombre ?? it?.nombre ?? 'Producto'))
    const cant = Number(it?.cantidad) || 1
    const precio = Number(it?.producto?.precio ?? it?.precio ?? 0)
    const raw = it?.producto?.imagen_url ?? it?.imagen_url
    return filaProducto(raw, n, cant, formatMonto(precio * cant), appUrl)
  }).join('')
  const productosLista = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${filas}</table>`

  const { asunto, cuerpo } = armarMailCarrito(
    etapa, nombre, productosLista, `${appUrl}/carrito`,
  )

  try {
    await sendEmail({ to: email, asunto, cuerpo })
    await supabaseAdmin
      .from('carritos_guardados')
      .update({ recordatorio_enviado: new Date().toISOString() })
      .eq('user_id', userId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al enviar.' }
  }
}
