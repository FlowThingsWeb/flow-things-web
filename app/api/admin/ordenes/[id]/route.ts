import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

// DELETE — elimina una orden SOLO si está pendiente. Las pendientes son pagos
// nunca aprobados (no descontaron stock ni generaron factura), así que se
// pueden borrar sin efectos colaterales. Las aprobadas/otras no se tocan.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth
  const { id } = await params

  const { data: orden, error: errGet } = await supabaseAdmin
    .from('ordenes')
    .select('id, estado')
    .eq('id', id)
    .maybeSingle()
  if (errGet) return NextResponse.json({ error: errGet.message }, { status: 500 })
  if (!orden) return NextResponse.json({ error: 'La orden no existe.' }, { status: 404 })
  if (orden.estado !== 'pending') {
    return NextResponse.json(
      { error: 'Solo se pueden eliminar órdenes pendientes.' },
      { status: 400 },
    )
  }

  const { error } = await supabaseAdmin.from('ordenes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
