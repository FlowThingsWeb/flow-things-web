import { supabaseAdmin } from './supabaseAdmin'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { sendTelegram, formatVentaMsg } from './telegram'
import { emitirFacturaC } from './afip'
import {
  sendEmail, renderTemplate, buildProductosFilas, buildDesgloseItems,
  buildFilaDescuento, buildMedioPago, DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO,
} from './email'
import { generateFacturaPDFBase64, facturaFileName } from './factura-pdf'
import { sendWhatsApp, DEFAULT_WPP_MENSAJE } from './whatsapp'
import { formatMonto } from './format'

const paymentClient = new Payment(new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! }))

/**
 * Procesa un pago aprobado: descuenta stock, incrementa uso de descuentos, emite
 * factura AFIP y envía notificaciones (email + WhatsApp + Telegram).
 *
 * Se ejecuta de forma asíncrona desde el cron de jobs, NO dentro del webhook,
 * para que el webhook responda rápido a MercadoPago y no dispare reintentos.
 *
 * Idempotencia: el webhook solo encola UN job por orden (la transición atómica a
 * 'approved' gana una sola vez). Todos los sub-pasos usan try/catch interno y la
 * función solo lanza si no puede LEER la orden (antes de cualquier efecto), para
 * que un reintento del job no duplique stock/factura.
 */
export async function procesarPagoAprobado(ordenId: string): Promise<void> {
  const { data: orden, error } = await supabaseAdmin
    .from('ordenes')
    .select('items, total, datos_comprador, descuento_monto, codigo_descuento, user_id, mp_payment_id')
    .eq('id', ordenId)
    .single()

  // Error de lectura → lanzamos para que el job reintente (aún no hicimos nada).
  if (error) throw new Error(`No se pudo leer la orden ${ordenId}: ${error.message}`)
  if (!orden?.items) return

  // Datos del pago desde MP (para el medio de pago del email). No es crítico.
  let payment: any = {}
  if (orden.mp_payment_id) {
    try {
      payment = await paymentClient.get({ id: orden.mp_payment_id })
    } catch (e: any) {
      console.error('[procesar-pago] No se pudo leer el pago de MP:', e.message)
    }
  }

  // ─── Descontar stock ────────────────────────────────────────────────────────
  for (const item of orden.items) {
    const { error: stockErr } = await supabaseAdmin.rpc('decrementar_stock', {
      p_producto_id: item.id,
      p_cantidad: item.cantidad,
    })
    if (stockErr) {
      console.error(`[procesar-pago] Error decrementando stock para producto ${item.id}:`, stockErr.message)
    }
  }

  // ─── Incrementar uso del código de descuento ──────────────────────────────────
  if (orden.codigo_descuento && orden.codigo_descuento !== '__PRIMER_COMPRA__') {
    const { data: codigoRow, error: errCodigo } = await supabaseAdmin
      .rpc('incrementar_uso_codigo', { p_codigo: orden.codigo_descuento })
      .select('id, un_uso_por_usuario')
      .single()
    if (errCodigo) {
      const { data: fallbackRow } = await supabaseAdmin
        .from('codigos_descuento')
        .select('id, usos_actuales, un_uso_por_usuario')
        .eq('codigo', orden.codigo_descuento)
        .single()
      if (fallbackRow) {
        await supabaseAdmin
          .from('codigos_descuento')
          .update({ usos_actuales: (fallbackRow.usos_actuales ?? 0) + 1 })
          .eq('codigo', orden.codigo_descuento)
      }
    }
    if (codigoRow && codigoRow.un_uso_por_usuario && orden.user_id) {
      await supabaseAdmin
        .from('descuentos_usos_usuario')
        .upsert({ codigo_id: codigoRow.id, user_id: orden.user_id }, { onConflict: 'codigo_id,user_id' })
    }
  }

  // ─── Marcar primer_compra_usada ──────────────────────────────────────────────
  if ((orden.codigo_descuento === '__PRIMER_COMPRA__' || (orden.datos_comprador?.primer_compra_monto ?? 0) > 0) && orden.user_id) {
    try {
      await supabaseAdmin.from('perfiles').upsert({ user_id: orden.user_id, primer_compra_usada: true })
    } catch (e: any) {
      console.error('[procesar-pago] Error marcando primer_compra_usada:', e.message)
    }
  }

  // ─── Factura electrónica AFIP ────────────────────────────────────────────────
  let facturaEmitida: { cae: string; nroComprobante: number; fecha: string; caeFechaVto: string } | null = null
  try {
    const comprador = orden.datos_comprador ?? {}
    facturaEmitida = await emitirFacturaC({
      nombre: comprador.nombre || 'Consumidor Final',
      email: comprador.email || '',
      total: orden.total ?? 0,
      dni: comprador.dni || undefined,
      items: orden.items.map((i: any) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })),
    })

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
    console.error('[afip] Error emitiendo factura:', facturaErr.message)
    try {
      const comprador = orden.datos_comprador ?? {}
      await supabaseAdmin
        .from('ordenes')
        .update({
          datos_comprador: {
            ...comprador,
            factura_pendiente: true,
            factura_error: String(facturaErr?.message ?? facturaErr).slice(0, 500),
          },
        })
        .eq('id', ordenId)
    } catch (markErr: any) {
      console.error('[afip] Error marcando factura_pendiente:', markErr.message)
    }
    await sendTelegram(
      `⚠️ FACTURA PENDIENTE\nOrden ${ordenId}\nTotal: $${orden.total ?? 0}\n` +
      `Error AFIP: ${String(facturaErr?.message ?? facturaErr).slice(0, 300)}\n` +
      `Emitir manualmente desde el panel.`
    ).catch((e: any) => console.error('[telegram] Error avisando factura pendiente:', e.message))
  }

  // ─── Notificaciones al comprador (email + WhatsApp) ──────────────────────────
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

    const fmt = formatMonto
    const totalFmt = fmt(orden.total ?? 0)
    const fechaFmt = new Date().toLocaleDateString('es-AR')

    const mappedItems = items.map((i: any) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }))
    const vars: Record<string, string> = {
      nombre:          compradorData.nombre || 'cliente',
      orden_id:        String(ordenId),
      total:           totalFmt,
      subtotal:        fmt(subtotal),
      desglose_items:  buildDesgloseItems(mappedItems),
      envio:           costoEnvio > 0 ? fmt(costoEnvio) : 'Gratis',
      descuento:       descuentoMonto > 0 ? fmt(descuentoMonto) : '',
      fila_descuento:  buildFilaDescuento(codigoDescuento, descuentoMonto),
      productos_filas: buildProductosFilas(mappedItems),
      fecha:           fechaFmt,
      medio_pago:      buildMedioPago(payment),
      productos:       items.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(', '),
    }

    const emailHabilitado = cfg.notif_email_habilitado !== 'false'
    if (emailHabilitado && compradorData.email) {
      const asunto = renderTemplate(cfg.notif_email_asunto || DEFAULT_EMAIL_ASUNTO, vars)
      const cuerpo = renderTemplate(cfg.notif_email_cuerpo || DEFAULT_EMAIL_CUERPO, vars)

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

    const wppHabilitado = cfg.notif_wpp_habilitado === 'true'
    if (wppHabilitado && compradorData.telefono) {
      const mensaje = renderTemplate(cfg.notif_wpp_mensaje || DEFAULT_WPP_MENSAJE, vars)
      await sendWhatsApp({ to: compradorData.telefono, mensaje }).catch(e =>
        console.error('[whatsapp] Error:', e.message))
    }
  } catch (notifErr: any) {
    console.error('[notificaciones] Error:', notifErr.message)
  }

  // ─── Notificación Telegram al negocio ────────────────────────────────────────
  const comprador = orden.datos_comprador ?? {}
  const msg = formatVentaMsg({
    ordenId,
    total: orden.total ?? 0,
    comprador: { nombre: comprador.nombre, email: comprador.email, telefono: comprador.telefono },
    items: orden.items.map((i: any) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })),
    envio: { nombre: comprador.envio_nombre ?? null, costo: comprador.envio_costo ?? 0 },
  })
  await sendTelegram(msg).catch((e: any) =>
    console.error('[telegram] Error enviando notificación:', e.message))
}
