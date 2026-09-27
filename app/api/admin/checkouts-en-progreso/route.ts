import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

/**
 * GET — checkouts en progreso: dejaron su email en el formulario y nunca
 * llegaron al botón de pagar. Incluye invitados sin cuenta, que son la
 * mayoría de quienes abandonan.
 */
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { data: filas } = await supabaseAdmin
    .from('checkouts_en_progreso')
    .select('id, email, nombre, telefono, items, total, updated_at, convertido_at, recordatorio_2h_at, recordatorio_24h_at, recordatorio_7d_at')
    .order('updated_at', { ascending: false })
    .limit(300)

  const conItems = (filas ?? []).filter(
    (c) => Array.isArray(c.items) && c.items.length > 0,
  )
  if (conItems.length === 0) return NextResponse.json({ data: [] })

  /**
   * Compró después con el mismo mail.
   *
   * `convertido_at` ya lo marca cuando el checkout sigue el camino normal.
   * Esto además agarra la compra que entró por otra vía —una orden cargada a
   * mano, un pago por fuera— para que el panel no invite a escribirle a
   * alguien que ya pagó.
   */
  const { data: aprobadas } = await supabaseAdmin
    .from('ordenes')
    .select('datos_comprador, created_at')
    .eq('estado', 'approved')
  const ultimaPorEmail = new Map<string, string>()
  for (const o of aprobadas || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const em = (o.datos_comprador as any)?.email?.toLowerCase()
    if (!em) continue
    const prev = ultimaPorEmail.get(em)
    if (!prev || o.created_at > prev) ultimaPorEmail.set(em, o.created_at)
  }

  const data = conItems.map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = c.items
    const ultima = ultimaPorEmail.get(String(c.email).toLowerCase())
    // La etapa más avanzada que ya salió, para mostrar por dónde va.
    const ultimoEnvio = [c.recordatorio_7d_at, c.recordatorio_24h_at, c.recordatorio_2h_at]
      .find((v) => !!v) ?? null
    return {
      id: c.id,
      email: c.email,
      nombre: c.nombre || String(c.email).split('@')[0] || '',
      telefono: c.telefono ?? '',
      productos: items.map((it) => ({
        nombre: String(it?.nombre ?? 'Producto'),
        cantidad: Number(it?.cantidad) || 1,
      })),
      total: Number(c.total ?? 0),
      updated_at: c.updated_at,
      ultimo_envio: ultimoEnvio,
      ya_compro: !!c.convertido_at || (!!ultima && ultima > c.updated_at),
    }
  })

  return NextResponse.json({ data })
}
