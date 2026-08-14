import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, renderTemplate, escapeHtml, filaProducto } from '@/lib/email'
import { DEFAULT_CARRITO_ASUNTO, DEFAULT_CARRITO_CUERPO } from '@/lib/email-constants'
import { formatMonto } from '@/lib/format'

/**
 * Arma y envía el email de recuperación de carrito abandonado a un usuario.
 * Marca recordatorio_enviado. Se usa desde el admin (envío manual) — el cron
 * tiene su propio loop batcheado.
 */
export async function enviarRecordatorioCarrito(
  userId: string,
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

  const cuerpo = renderTemplate(DEFAULT_CARRITO_CUERPO, {
    nombre: escapeHtml(nombre),
    productos_lista: productosLista,
    link: `${appUrl}/carrito`,
  })

  try {
    await sendEmail({ to: email, asunto: DEFAULT_CARRITO_ASUNTO, cuerpo })
    await supabaseAdmin
      .from('carritos_guardados')
      .update({ recordatorio_enviado: new Date().toISOString() })
      .eq('user_id', userId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al enviar.' }
  }
}
