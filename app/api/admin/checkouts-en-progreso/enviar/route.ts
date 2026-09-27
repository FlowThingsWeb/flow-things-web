import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { enviarRecordatorioCheckoutEnProgreso } from '@/lib/checkout-en-progreso'

// POST — manda a mano el recordatorio a un checkout en progreso.
export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const res = await enviarRecordatorioCheckoutEnProgreso(id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
