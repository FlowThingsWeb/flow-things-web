import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import MercadoPagoConfig, { Payment } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const paymentClient = new Payment(client)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // MP envía diferentes tipos de notificaciones
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID missing' }, { status: 400 })
    }

    // Obtener datos del pago desde MP
    const payment = await paymentClient.get({ id: paymentId })

    const ordenId = payment.external_reference
    const estado = payment.status

    if (!ordenId || !estado) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Mapear estados de MP a nuestros estados
    const estadoMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      cancelled: 'cancelled',
      refunded: 'refunded',
      pending: 'pending',
      in_process: 'pending',
    }

    const nuevoEstado = estadoMap[estado] || 'pending'

    // Actualizar orden en Supabase
    const { error } = await supabaseAdmin
      .from('ordenes')
      .update({
        mp_payment_id: paymentId.toString(),
        estado: nuevoEstado,
      })
      .eq('id', ordenId)

    if (error) {
      console.error('Error actualizando orden:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Si el pago fue aprobado, descontar stock
    if (nuevoEstado === 'approved') {
      const { data: orden } = await supabaseAdmin
        .from('ordenes')
        .select('items')
        .eq('id', ordenId)
        .single()

      if (orden?.items) {
        for (const item of orden.items) {
          await supabaseAdmin.rpc('decrementar_stock', {
            p_producto_id: item.id,
            p_cantidad: item.cantidad,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// MP también hace GET para verificar el endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
