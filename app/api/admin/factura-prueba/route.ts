import { NextRequest, NextResponse } from 'next/server'
import { getTokenAuth } from '@/lib/afip-wsaa'
import { getLastVoucher, solicitarCAE } from '@/lib/afip-wsfe'
import { sendEmail, renderTemplate, DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO } from '@/lib/email'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { email?: string; facturaData?: Record<string, unknown>; pdfBase64?: string } = {}
  try { body = await req.json() } catch { /* no body */ }

  const { email, facturaData, pdfBase64 } = body

  // Si viene facturaData y email → solo enviar el email (sin emitir nueva factura)
  if (email && facturaData) {
    try {
      const { data: rows } = await supabase.from('configuracion').select('clave,valor')
      const cfg: Record<string, string> = {}
      ;(rows || []).forEach((r: { clave: string; valor: string }) => { cfg[r.clave] = r.valor })

      const asunto = cfg.notif_email_asunto || DEFAULT_EMAIL_ASUNTO
      const template = cfg.notif_email_cuerpo || DEFAULT_EMAIL_CUERPO

      const cuerpo = renderTemplate(template, {
        nombre: 'Admin (prueba)',
        orden_id: String(facturaData.nroComprobante ?? '–'),
        total: facturaData.importe as string || '$1,00',
        subtotal: facturaData.importe as string || '$1,00',
        envio: 'Gratis',
        descuento: '',
        fila_descuento: '',
        productos_filas: '<tr><td style="font-size:14px;color:#111;padding:12px 0">Factura de prueba – Flow Things</td><td style="text-align:center;padding:12px 0;color:#666">1</td><td style="text-align:right;padding:12px 0;color:#111">$1,00</td></tr>',
        productos: 'Factura de prueba – Flow Things',
        fecha: facturaData.fecha as string || new Date().toLocaleDateString('es-AR'),
        medio_pago: 'Mercado Pago (prueba)',
      })

      const adjuntos = pdfBase64
        ? [{
            filename: `FACTURA #${facturaData.nroComprobante ?? 'prueba'}.pdf`,
            content: pdfBase64,
            encoding: 'base64' as const,
            contentType: 'application/pdf',
          }]
        : undefined

      await sendEmail({ to: email, asunto: 'Factura de prueba – Flow Things', cuerpo, adjuntos })
      return NextResponse.json({ ok: true, emailEnviado: true })
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
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[factura-prueba]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
