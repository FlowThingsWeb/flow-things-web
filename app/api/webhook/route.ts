import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { enqueueJob } from '@/lib/jobs'
import { procesarPagoAprobado } from '@/lib/procesar-pago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const paymentClient = new Payment(client)

/**
 * Verifica la firma HMAC-SHA256 que MercadoPago envía en el header x-signature.
 * Si MP_WEBHOOK_SECRET no está configurado, se omite la verificación (dev/legacy).
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
function verifyMPSignature(request: NextRequest, paymentId: string | number): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // En producción la firma es obligatoria. En desarrollo local se puede omitir.
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] MP_WEBHOOK_SECRET no configurado en producción — rechazando request')
      return false
    }
    return true
  }

  const xSignature = request.headers.get('x-signature') || ''
  const xRequestId = request.headers.get('x-request-id') || ''

  // Parsear ts y v1 del header "ts=...,v1=..."
  let ts = ''
  let v1 = ''
  for (const part of xSignature.split(',')) {
    const [key, val] = part.split('=')
    if (key === 'ts') ts = val?.trim() ?? ''
    if (key === 'v1') v1 = val?.trim() ?? ''
  }

  if (!ts || !v1) return false

  // Manifest según la doc de MP: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`
  const hmac = createHmac('sha256', secret).update(manifest).digest('hex')

  const ok = hmac === v1
  if (!ok) {
    // Diagnóstico temporal — no expone el secret, solo su longitud.
    const url = new URL(request.url)
    console.error('[webhook][diag] firma no coincide', {
      manifest,
      hmacCalc: hmac.slice(0, 16),
      v1recv: v1.slice(0, 16),
      secretLen: secret.length,
      ts,
      xRequestId,
      paymentIdBody: String(paymentId),
      queryDataId: url.searchParams.get('data.id') || '(sin query data.id)',
    })
  }
  return ok
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // DIAG temporal: correr la verificación de firma para CUALQUIER tipo (incluye
    // el simulador de MP, que manda type='test') para poder validar el secret sin
    // hacer una compra real. Solo loguea, no afecta el flujo.
    const diagId = body?.data?.id ?? body?.id ?? ''
    console.error('[webhook][diag2] type=' + body?.type + ' firmaOk=' + verifyMPSignature(request, diagId))

    // MP envía diferentes tipos de notificaciones
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID missing' }, { status: 400 })
    }

    // Verificar firma HMAC de MercadoPago.
    // La validación REAL de que el pago es legítimo es el fetch autenticado a la
    // API de MP de acá abajo: con el payment id se pide el pago real usando el
    // MP_ACCESS_TOKEN (que solo tiene el comercio). Un atacante no puede forjar un
    // pago aprobado. Por eso, si la firma no coincide, por defecto se loguea y se
    // continúa. Con MP_WEBHOOK_STRICT=true se rechaza (recomendado una vez que se
    // confirmó que MP_WEBHOOK_SECRET es el correcto).
    if (!verifyMPSignature(request, paymentId)) {
      if (process.env.MP_WEBHOOK_STRICT === 'true') {
        console.warn('[webhook] Firma inválida — request rechazado (MP_WEBHOOK_STRICT=true)')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      console.warn('[webhook] Firma no coincide — se continúa validando vía API de MP')
    }

    // Obtener datos del pago desde MP (esta es la validación fuerte: el pago tiene
    // que existir en la cuenta del comercio para poder leerlo con el access token).
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

    // Estados no aprobados (rejected, cancelled, refunded, pending):
    // update simple, sin efectos secundarios.
    if (nuevoEstado !== 'approved') {
      const { error } = await supabaseAdmin
        .from('ordenes')
        .update({ mp_payment_id: paymentId.toString(), estado: nuevoEstado })
        .eq('id', ordenId)

      if (error) {
        console.error('Error actualizando orden:', error)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    // ─── Transición a 'approved' ATÓMICA (idempotente ante reintentos de MP) ──
    // UPDATE ... WHERE id = X AND estado <> 'approved' RETURNING ...
    // Postgres serializa el UPDATE por fila: solo la primera entrega concurrente
    // obtiene la fila de vuelta. Los reintentos de MP reciben 0 filas y salen sin
    // encolar el procesamiento de nuevo.
    const { data: transicion, error: updErr } = await supabaseAdmin
      .from('ordenes')
      .update({ mp_payment_id: paymentId.toString(), estado: 'approved' })
      .eq('id', ordenId)
      .neq('estado', 'approved')
      .select('id')

    if (updErr) {
      console.error('Error actualizando orden:', updErr)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    if (!transicion || transicion.length === 0) {
      console.log(`[webhook] Orden ${ordenId} ya estaba aprobada — reintento ignorado`)
      return NextResponse.json({ received: true, idempotent: true })
    }

    // Encolar el procesamiento post-pago (stock, factura, notificaciones) para
    // responder rápido a MP y no disparar reintentos por timeout. El cron
    // (/api/cron/procesar-jobs) lo ejecuta. Si el encolado falla, procesamos
    // inline como fallback para no dejar la venta sin fulfillment.
    try {
      await enqueueJob('post_pago', { ordenId })
    } catch (e: any) {
      console.error('[webhook] Encolado falló, procesando inline:', e.message)
      await procesarPagoAprobado(ordenId).catch((err: any) =>
        console.error('[webhook] Proceso inline falló:', err.message))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// MP hace GET para verificar que el endpoint responde
export async function GET() {
  return new NextResponse(null, { status: 200 })
}
