import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { sendTelegram, formatVentaMsg } from '@/lib/telegram'
import { emitirFacturaC } from '@/lib/afip'
import { sendEmail, renderTemplate, buildProductosFilas, buildDesgloseItems, buildFilaDescuento, buildMedioPago, DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO } from '@/lib/email'
import { sendWhatsApp, DEFAULT_WPP_MENSAJE } from '@/lib/whatsapp'

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

        // Factura electrónica AFIP
        try {
          const comprador = orden.datos_comprador ?? {}
          const factura = await emitirFacturaC({
            nombre: comprador.nombre || 'Consumidor Final',
            email: comprador.email || '',
            total: orden.total ?? 0,
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
                factura_cae: factura.cae,
                factura_nro: factura.nroComprobante,
                factura_fecha: factura.fecha,
                factura_vto: factura.caeFechaVto,
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
            await sendEmail({ to: compradorData.email, asunto, cuerpo }).catch(e =>
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
        const envio = comprador.envio ?? {}
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
            nombre: envio.nombre,
            costo: envio.costo,
          },
        })
        await sendTelegram(msg)
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
