import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { itemsDeCheckout } from '@/lib/checkout-en-progreso'

// GET — ítems de una orden pendiente o de un checkout en progreso, para volver
// a cargarlos en el carrito.
// Solo devuelve datos de productos (nada personal). El id es un UUID.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: orden } = await supabaseAdmin
    .from('ordenes')
    .select('estado, items')
    .eq('id', id)
    .maybeSingle()

  /**
   * El mismo link sirve para las dos cosas.
   *
   * Los recordatorios de checkout en progreso —el carrito de quien dejó su
   * email y no llegó a pagar— apuntan acá con el id de su propia fila. Son
   * UUID, así que no hay forma de que uno se confunda con una orden.
   */
  const crudos = orden?.estado === 'pending'
    ? (Array.isArray(orden.items) ? orden.items : [])
    : await itemsDeCheckout(id)

  if (crudos.length === 0) return NextResponse.json({ items: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = crudos.map((it: any) => ({
    id: it?.id,
    nombre: it?.nombre,
    precio: Number(it?.precio ?? 0),
    cantidad: Number(it?.cantidad) || 1,
    imagen_url: it?.imagen_url ?? null,
    variante_id: it?.variante_id ?? null,
  })).filter((it: { id?: string }) => it.id)

  return NextResponse.json({ items })
}
