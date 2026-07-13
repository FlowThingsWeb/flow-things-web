import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, renderTemplate, escapeHtml } from '@/lib/email'
import { DEFAULT_CARRITO_ASUNTO, DEFAULT_CARRITO_CUERPO } from '@/lib/email-constants'
import { formatMonto } from '@/lib/format'

export const maxDuration = 60

// Ventana de recordatorio: carritos inactivos hace más de 1h pero menos de 48h.
const MIN_HORAS = 1
const MAX_HORAS = 48
const BATCH = 25

/**
 * Cron: envía email de recuperación a carritos abandonados (usuarios logueados
 * con carrito guardado). Protegido con CRON_SECRET. Marca recordatorio_enviado
 * para no repetir; CartSync lo re-arma (null) cuando el carrito cambia.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  const ahora = Date.now()
  const desde = new Date(ahora - MAX_HORAS * 3600_000).toISOString()
  const hasta = new Date(ahora - MIN_HORAS * 3600_000).toISOString()

  const { data: carritos } = await supabaseAdmin
    .from('carritos_guardados')
    .select('user_id, items, updated_at')
    .is('recordatorio_enviado', null)
    .gt('updated_at', desde)
    .lt('updated_at', hasta)
    .limit(BATCH)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')
  let enviados = 0

  for (const c of carritos || []) {
    const items = Array.isArray(c.items) ? c.items : []
    if (items.length === 0) continue

    // Email del usuario
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(c.user_id)
    const email = userRes?.user?.email
    if (!email) continue

    // Nombre desde perfil (fallback: parte local del email)
    const { data: perfil } = await supabaseAdmin
      .from('perfiles').select('nombre').eq('user_id', c.user_id).single()
    const nombre = perfil?.nombre || email.split('@')[0] || 'Hola'

    // Lista de productos (HTML seguro)
    const filas = items.map((it: any) => {
      const n = escapeHtml(String(it?.producto?.nombre ?? it?.nombre ?? 'Producto'))
      const cant = Number(it?.cantidad) || 1
      const precio = Number(it?.producto?.precio ?? it?.precio ?? 0)
      return `<tr>
        <td style="padding:8px 0;font-size:14px;color:#374151">${cant}× ${n}</td>
        <td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;font-weight:600">${formatMonto(precio * cant)}</td>
      </tr>`
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
        .eq('user_id', c.user_id)
      enviados++
    } catch (e: any) {
      console.error('[carrito-abandonado] error enviando a', email, e.message)
    }
  }

  return NextResponse.json({ candidatos: carritos?.length ?? 0, enviados })
}
