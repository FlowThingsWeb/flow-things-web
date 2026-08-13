import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

// GET — órdenes pendientes con email (checkouts abandonados, invitados incluidos).
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { data: pendientes } = await supabaseAdmin
    .from('ordenes')
    .select('id, total, items, datos_comprador, created_at, recordatorio_carrito_at')
    .eq('estado', 'pending')
    .order('created_at', { ascending: false })
    .limit(300)

  // Emails que ya concretaron una compra aprobada (para marcar "ya compró").
  const { data: aprobadas } = await supabaseAdmin
    .from('ordenes')
    .select('datos_comprador, created_at')
    .eq('estado', 'approved')
  const ultimaAprobadaPorEmail = new Map<string, string>()
  for (const o of aprobadas || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const em = (o.datos_comprador as any)?.email?.toLowerCase()
    if (!em) continue
    const prev = ultimaAprobadaPorEmail.get(em)
    if (!prev || o.created_at > prev) ultimaAprobadaPorEmail.set(em, o.created_at)
  }

  const data = (pendientes || [])
    .map((o) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comprador: any = o.datos_comprador ?? {}
      const email: string = (comprador.email ?? '').toLowerCase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = Array.isArray(o.items) ? o.items : []
      return {
        orden_id: o.id,
        email,
        nombre: comprador.nombre || email.split('@')[0] || '',
        productos: items.map((it) => ({
          nombre: String(it?.nombre ?? 'Producto'),
          cantidad: Number(it?.cantidad) || 1,
        })),
        total: Number(o.total ?? 0),
        created_at: o.created_at,
        recordatorio_carrito_at: o.recordatorio_carrito_at ?? null,
        ya_compro:
          !!email &&
          !!ultimaAprobadaPorEmail.get(email) &&
          ultimaAprobadaPorEmail.get(email)! > o.created_at,
      }
    })
    .filter((o) => o.email && o.productos.length > 0)

  return NextResponse.json({ data })
}
