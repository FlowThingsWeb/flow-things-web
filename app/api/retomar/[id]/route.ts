import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET — ítems de una orden pendiente, para volver a cargarlos en el carrito.
// Solo devuelve datos de productos (nada personal). El id es un UUID.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: orden } = await supabaseAdmin
    .from('ordenes')
    .select('estado, items')
    .eq('id', id)
    .maybeSingle()

  if (!orden || orden.estado !== 'pending') {
    return NextResponse.json({ items: [] })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (Array.isArray(orden.items) ? orden.items : []).map((it: any) => ({
    id: it?.id,
    nombre: it?.nombre,
    precio: Number(it?.precio ?? 0),
    cantidad: Number(it?.cantidad) || 1,
    imagen_url: it?.imagen_url ?? null,
    variante_id: it?.variante_id ?? null,
  })).filter((it: { id?: string }) => it.id)

  return NextResponse.json({ items })
}
