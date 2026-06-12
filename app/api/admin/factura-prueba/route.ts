import { NextRequest, NextResponse } from 'next/server'
import { getTokenAuth } from '@/lib/afip-wsaa'
import { getLastVoucher, solicitarCAE } from '@/lib/afip-wsfe'
import { sendEmail, renderTemplate, DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO } from '@/lib/email'
import { generateFacturaPDFBase64, facturaFileName } from '@/lib/factura-pdf'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { email?: string; facturaData?: Record<string, unknown> } = {}
  try { body = await req.json() } catch { /* no body */ }

  const { email, facturaData } = body

  // Si viene facturaData y email → generar PDF en el servidor y enviar email
  if (email && facturaData) {
    try {
      const { data: rows } = await supabase.from('configuracion').select('clave,valor')
      const cfg: Record<string, string> = {}
      ;(rows || []).forEach((r: { clave: string; valor: string }) => { cfg[r.clave] = r.valor })

      const template = cfg.notif_email_cuerpo || DEFAULT_EMAIL_CUERPO
      const itemLabel = '<tr><td style="font-size:14px;color:#374151;padding:5px 0">Factura de prueba – Flow Things × 1</td><td style="font-size:14px;color:#374151;text-align:right;padding:5px 0;font-weight:500;white-space:nowrap">$ 1,00</td></tr>'

      const cuerpo = renderTemplate(template, {
        nombre:          'Admin (prueba)',
        orden_id:        String(facturaData.nroComprobante ?? '–'),
        total:           '$ 1,00',
        subtotal:        '$ 1,00',
        desglose_items:  itemLabel,
        envio:           'Gratis',
        descuento:       '',
        fila_descuento:  '',
        productos_filas: '<tr><td style="font-size:14px;color:#111;padding:12px 0">Factura de prueba – Flow Things</td><td style="text-align:center;padding:12px 0;color:#666">1</td><td style="text-align:right;padding:12px 0;color:#111">$ 1,00</td></tr>',
        productos:       'Factura de prueba – Flow Things',
        fecha:           facturaData.fecha as string || new Date().toLocaleDateString('es-AR'),
        medio_pago:      'Mercado Pago (prueba)',
      })

      // Generar el PDF en el servidor con los datos de la factura emitida
      let adjuntos: { filename: string; content: string; encoding: 'base64'; contentType: 'application/pdf' }[] | undefined
      try {
        const nro  = Number(facturaData.nroComprobante)
        const pdfBase64 = await generateFacturaPDFBase64({
          nroComprobante: nro,
          ptoVenta:       Number(facturaData.ptoVenta),
          cuit:           Number(facturaData.cuit),
          fecha:          String(facturaData.fecha   || new Date().toLocaleDateString('es-AR')),
          fechaISO:       String(facturaData.fechaISO || new Date().toISOString().slice(0, 10)),
          caeFechaVto:    String(facturaData.caeFechaVto || ''),
          cae:            String(facturaData.cae),
          totalNumerico:  Number(facturaData.totalNumerico || 1),
          items: (facturaData.items as { descripcion: string; cantidad: number; precioUnitario: number }[])
            ?? [{ descripcion: 'Factura de prueba – Flow Things', cantidad: 1, precioUnitario: 1.00 }],
        })
        adjuntos = [{ filename: facturaFileName(nro), content: pdfBase64, encoding: 'base64', contentType: 'application/pdf' }]
      } catch (pdfErr: any) {
        console.error('[factura-prueba] PDF error:', pdfErr.message)
      }

      await sendEmail({ to: email, asunto: 'Factura de prueba – Flow Things', cuerpo, adjuntos })
      return NextResponse.json({ ok: true, emailEnviado: true, tienePDF: !!adjuntos })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar email'
      console.error('[factura-prueba] email error', err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // Flujo normal: emitir factura
  try {
    const cert = (process.env.AFIP_CERT || '').replace(/\\n/g, '\n')
    const key = (process.env.AFIP_KEY || '').replace(/\\n/g, '\n')
    const cuit = Number(process.env.AFIP_CUIT)
    const ptoVenta = Number(process.env.AFIP_PTO_VENTA || 5)

    if (!cert || !key || !cuit) {
      return NextResponse.json({ error: 'Faltan variables AFIP_CERT, AFIP_KEY o AFIP_CUIT' }, { status: 500 })
    }

    const { token: wsaaToken, sign } = await getTokenAuth('wsfe', cert, key)
    const ultimoNro = await getLastVoucher(wsaaToken, sign, cuit, ptoVenta, 11)
    const nroComprobante = ultimoNro + 1

    const result = await solicitarCAE(wsaaToken, sign, cuit, ptoVenta, nroComprobante, 1.00)

    return NextResponse.json({
      ok: true,
      cae: result.cae,
      caeFechaVto: result.caeFechaVto,
      nroComprobante: result.nroComprobante,
      ptoVenta,
      cuit,
      fecha: new Date().toLocaleDateString('es-AR'),
      fechaISO: new Date().toISOString().slice(0, 10),
      importe: '$1,00 (factura de prueba)',
      totalNumerico: 1.00,
      ambiente: 'PRODUCCIÓN',
      items: [{ descripcion: 'Factura de prueba – Flow Things', cantidad: 1, precioUnitario: 1.00 }],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[factura-prueba]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
