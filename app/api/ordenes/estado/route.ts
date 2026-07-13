import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConfig } from '@/lib/config'

/**
 * GET /api/ordenes/estado?id=xxx
 * Endpoint público — devuelve estado + resumen de la orden (total e items).
 * NO expone datos del comprador (nombre, DNI, dirección, pago). El id es un UUID
 * no adivinable, y los items/total no son información sensible.
 */
export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('ordenes')
    .select('estado, total, items, descuento_monto, datos_comprador')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  // Exponer solo campos no sensibles de cada item.
  const items = Array.isArray(data.items)
    ? data.items.map((i: { nombre: string; cantidad: number; precio: number; imagen_url?: string | null }) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: i.precio,
        imagen_url: i.imagen_url ?? null,
      }))
    : []

  // Envío y descuento para el resumen (no son datos sensibles del comprador).
  const envio = Number(data.datos_comprador?.envio_costo ?? 0)
  const descuento = Number(data.descuento_monto ?? 0)

  // Cupón para la próxima compra (editable desde /admin/descuentos).
  const cfg = await getConfig()
  const cupon_postcompra = cfg.cupon_postcompra_codigo || ''

  return NextResponse.json({ estado: data.estado, total: data.total, items, envio, descuento, cupon_postcompra })
}
