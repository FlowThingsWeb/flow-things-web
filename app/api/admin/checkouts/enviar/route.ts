import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { enviarRecordatorioCheckout } from '@/lib/checkout-abandonado'

// POST — envía manualmente el mail de "terminá tu compra" a una orden pendiente.
export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { orden_id } = await req.json()
  if (!orden_id) return NextResponse.json({ error: 'Falta orden_id' }, { status: 400 })

  const res = await enviarRecordatorioCheckout(orden_id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
