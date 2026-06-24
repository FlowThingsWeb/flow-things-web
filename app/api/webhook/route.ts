import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { sendTelegram, formatVentaMsg } from '@/lib/telegram'
import { emitirFacturaC } from '@/lib/afip'
import { sendEmail, renderTemplate, buildProductosFilas, buildDesgloseItems, buildFilaDescuento, buildMedioPago, DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO } from '@/lib/email'
import { generateFacturaPDFBase64, facturaFileName } from '@/lib/factura-pdf'
import { sendWhatsApp, DEFAULT_WPP_MENSAJE } from '@/lib/whatsapp'

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
  if (!secret) return true // omitir en desarrollo si no está configurado

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

  // Manifest según la doc de MP
  const manifest = `id:${paymentId};request-date:${ts};`
  const hmac = createHmac('sha256', secret).update(manifest).digest('hex')

  return hmac === v1
}

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

    // Verificar firma HMAC de MercadoPago
    if (!verifyMPSignature(request, paymentId)) {
      console.warn('[webhook] Firma inválida — request rechazado')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
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

    // Idempotencia: si la orden ya está aprobada, ignorar el reintento de MP
    if (nuevoEstado === 'approved') {
      const { data: ordenActual } = await supabaseAdmin
        .from('ordenes')
        .select('estado')
        .eq('id', ordenId)
        .single()

      if (ordenActual?.estado === 'approved') {
        console.log(`[webhook] Orden ${ordenId} ya estaba aprobada — reintento ignorado`)
        return NextResponse.json({ received: true, idempotent: true })
      }
    }

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

    // Si el pago fue aprobado, descontar stock y notificar por Telegram
    if (nuevoEstado === 'approved') {
      const { data: orden } = await supabaseAdmin
        .from('ordenes')
        .select('items, total, datos_comprador, descuento_monto, codigo_descuento')
        .eq('id', ordenId)
        .single()

      if (orden?.items) {
        for (const item of orden.items) {
          await supabaseAdmin.rpc('decrementar_stock', {
            p_producto_id: item.id,
            p_cantidad: item.cantidad,
          })
        }

        // Incrementar uso del código de descuento (se hace aquí, no en checkout,
        // para no quemar el código si el usuario abandona el pago)
        if (orden.codigo_descuento) {
          const { data: codigoRow } = await supabaseAdmin
            .from('codigos_descuento')
            .select('usos_actuales')
            .eq('codigo', orden.codigo_descuento)
            .single()
          if (codigoRow) {
            const { error: errCodigo } = await supabaseAdmin
              .from('codigos_descuento')
              .update({ usos_actuales: (codigoRow.usos_actuales ?? 0) + 1 })
              .eq('codigo', orden.codigo_descuento)
            if (errCodigo) console.error('[webhook] Error incrementando uso de código:', errCodigo.message)
          }
        }

        // Factura electrónica AFIP
        // Declarada fuera del try para que el bloque de notificaciones pueda leerla
        let facturaEmitida: { cae: string; nroComprobante: number; fecha: string; caeFechaVto: string } | null = null
        try {
          const comprador = orden.datos_comprador ?? {}
          facturaEmitida = await emitirFacturaC({
            nombre: comprador.nombre || 'Consumidor Final',
            email: comprador.email || '',
            total: orden.total ?? 0,
            dni: comprador.dni || undefined,
            items: orden.items.map((i: any) => ({
              nombre: i.nombre,
              cantidad: i.cantidad,
              precio: i.precio,
            })),
          })

          // Guardar CAE en la orden
          await supabaseAdmin
            .from('ordenes')
            .update({
              datos_comprador: {
                ...comprador,
                factura_cae: facturaEmitida.cae,
                factura_nro: facturaEmitida.nroComprobante,
                factura_fecha: facturaEmitida.fecha,
                factura_vto: facturaEmitida.caeFechaVto,
              },
            })
            .eq('id', ordenId)
        } catch (facturaErr: any) {
          // No cortamos el flujo si falla la factura
          console.error('[afip] Error emitiendo factura:', facturaErr.message)
        }

        // Notificaciones al comprador (email + WPP)
        try {
          const { data: cfgRows } = await supabaseAdmin
            .from('configuracion')
            .select('clave, valor')
            .in('clave', ['notif_email_habilitado','notif_email_asunto','notif_email_cuerpo','notif_wpp_habilitado','notif_wpp_mensaje'])

          const cfg: Record<string, string> = {}
          ;(cfgRows || []).forEach((r: { clave: string; valor: string }) => { cfg[r.clave] = r.valor })

          const compradorData = orden.datos_comprador ?? {}
          const items = orden.items as any[]
          const descuentoMonto = Number(orden.descuento_monto ?? 0)
          const codigoDescuento: string | null = orden.codigo_descuento ?? null
          const costoEnvio = Number(compradorData.envio_costo ?? 0)
          const subtotal = items.reduce((s: number, i: any) => s + i.precio * i.cantidad, 0)

          const fmt = (n: number) =>
            '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

          const totalFmt = fmt(orden.total ?? 0)
          const fechaFmt = new Date().toLocaleDateString('es-AR')

          const mappedItems = items.map((i: any) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }))
          const productosFilas = buildProductosFilas(mappedItems)
          const desgloseItems  = buildDesgloseItems(mappedItems)
          const filaDescuento  = buildFilaDescuento(codigoDescuento, descuentoMonto)

          const vars: Record<string, string> = {
            nombre:          compradorData.nombre || 'cliente',
            orden_id:        String(ordenId),
            total:           totalFmt,
            subtotal:        fmt(subtotal),
            desglose_items:  desgloseItems,
            envio:           costoEnvio > 0 ? fmt(costoEnvio) : 'Gratis',
            descuento:       descuentoMonto > 0 ? fmt(descuentoMonto) : '',
            fila_descuento:  filaDescuento,
            productos_filas: productosFilas,
            fecha:           fechaFmt,
            // retrocompatibilidad
            medio_pago:      buildMedioPago(payment),
            productos: items.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(', '),
          }

          // Email
          const emailHabilitado = cfg.notif_email_habilitado !== 'false'
          if (emailHabilitado && compradorData.email) {
            const asunto = renderTemplate(cfg.notif_email_asunto || DEFAULT_EMAIL_ASUNTO, vars)
            const cuerpo = renderTemplate(cfg.notif_email_cuerpo || DEFAULT_EMAIL_CUERPO, vars)

            // Adjuntar la factura PDF — usar datos de la factura recién emitida
            let adjuntos: { filename: string; content: string; encoding: 'base64'; contentType: 'application/pdf' }[] | undefined
            const ptoVenta = Number(process.env.AFIP_PTO_VENTA || 5)
            const cuit     = Number(process.env.AFIP_CUIT)

            if (facturaEmitida) {
              try {
                const pdfBase64 = await generateFacturaPDFBase64({
                  nroComprobante: facturaEmitida.nroComprobante,
                  ptoVenta,
                  cuit,
                  fecha:         facturaEmitida.fecha || fechaFmt,
                  fechaISO:      new Date().toISOString().slice(0, 10),
                  caeFechaVto:   facturaEmitida.caeFechaVto || '',
                  cae:           facturaEmitida.cae,
                  totalNumerico: orden.total ?? 0,
                  cliente: {
                    nombre:     compradorData.nombre    || 'Consumidor Final',
                    cuitDni:    compradorData.dni        || '–',
                    direccion:  compradorData.direccion  || '–',
                    ciudad:     compradorData.ciudad     || '–',
                  },
                  items: items.map((i: any) => ({
                    descripcion:    i.nombre,
                    cantidad:       i.cantidad,
                    precioUnitario: i.precio,
                  })),
                  costoEnvio,
                })
                adjuntos = [{
                  filename:    facturaFileName(facturaEmitida.nroComprobante),
                  content:     pdfBase64,
                  encoding:    'base64',
                  contentType: 'application/pdf',
                }]
              } catch (pdfErr: any) {
                console.error('[email] Error generando PDF factura:', pdfErr.message)
              }
            }

            await sendEmail({ to: compradorData.email, asunto, cuerpo, adjuntos }).catch(e =>
              console.error('[email] Error:', e.message))
          }

          // WhatsApp
          const wppHabilitado = cfg.notif_wpp_habilitado === 'true'
          if (wppHabilitado && compradorData.telefono) {
            const mensaje = renderTemplate(cfg.notif_wpp_mensaje || DEFAULT_WPP_MENSAJE, vars)
            await sendWhatsApp({ to: compradorData.telefono, mensaje }).catch(e =>
              console.error('[whatsapp] Error:', e.message))
          }
        } catch (notifErr: any) {
          console.error('[notificaciones] Error:', notifErr.message)
        }

        // Notificación Telegram
        const comprador = orden.datos_comprador ?? {}
        const msg = formatVentaMsg({
          ordenId,
          total: orden.total ?? 0,
          comprador: {
            nombre: comprador.nombre,
            email: comprador.email,
            telefono: comprador.telefono,
          },
          items: orden.items.map((i: any) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precio: i.precio,
          })),
          envio: {
            nombre: comprador.envio_nombre ?? null,
            costo: comprador.envio_costo ?? 0,
          },
        })
        await sendTelegram(msg).catch((e: any) =>
          console.error('[telegram] Error enviando notificación:', e.message)
        )
      }
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
