import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

// GET — carritos guardados con ítems (usuarios logueados que no finalizaron).
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { data: carritos } = await supabaseAdmin
    .from('carritos_guardados')
    .select('user_id, items, updated_at, recordatorio_enviado')
    .order('updated_at', { ascending: false })

  const conItems = (carritos || []).filter(
    (c) => Array.isArray(c.items) && c.items.length > 0,
  )
  if (conItems.length === 0) return NextResponse.json({ data: [] })

  const userIds = conItems.map((c) => c.user_id)

  // Perfiles (nombre)
  const { data: perfiles } = await supabaseAdmin
    .from('perfiles').select('user_id, nombre').in('user_id', userIds)
  const nombrePorUser = new Map((perfiles || []).map((p) => [p.user_id, p.nombre]))

  // Órdenes aprobadas por usuario (para saber si ya compró después del carrito)
  const { data: ordenes } = await supabaseAdmin
    .from('ordenes')
    .select('user_id, created_at')
    .eq('estado', 'approved')
    .in('user_id', userIds)
  const ultimaCompraPorUser = new Map<string, string>()
  for (const o of ordenes || []) {
    const prev = ultimaCompraPorUser.get(o.user_id)
    if (!prev || o.created_at > prev) ultimaCompraPorUser.set(o.user_id, o.created_at)
  }

  const data = await Promise.all(
    conItems.map(async (c) => {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(c.user_id)
      const email = userRes?.user?.email ?? ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = c.items
      const total = items.reduce((s, it) => {
        const cant = Number(it?.cantidad) || 1
        const precio = Number(it?.producto?.precio ?? it?.precio ?? 0)
        return s + precio * cant
      }, 0)
      const productos = items.map((it) => ({
        nombre: String(it?.producto?.nombre ?? it?.nombre ?? 'Producto'),
        cantidad: Number(it?.cantidad) || 1,
      }))
      const ultimaCompra = ultimaCompraPorUser.get(c.user_id) ?? null
      return {
        user_id: c.user_id,
        email,
        nombre: nombrePorUser.get(c.user_id) || email.split('@')[0] || '',
        productos,
        total,
        updated_at: c.updated_at,
        recordatorio_enviado: c.recordatorio_enviado,
        // Si compró DESPUÉS de actualizar el carrito, ya no está abandonado.
        ya_compro: !!ultimaCompra && ultimaCompra > c.updated_at,
      }
    }),
  )

  return NextResponse.json({ data })
}
