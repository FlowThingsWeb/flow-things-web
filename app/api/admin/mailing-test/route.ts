import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { sendEmail, renderTemplate } from '@/lib/email'

// Datos de ejemplo para el email de prueba (cubre confirmación y despacho)
const SAMPLE_VARS: Record<string, string> = {
  // Confirmación
  nombre:          'María García',
  orden_id:        '12345',
  total:           '$ 8.500,00',
  subtotal:        '$ 8.000,00',
  envio:           '$ 1.200,00',
  descuento:       '$ 800,00',
  fecha:           new Date().toLocaleDateString('es-AR'),
  productos:       '• Muñeca articulada premium x1<br/>• LEGO City Set 60303 x2',
  fila_descuento:  '<tr><td style="font-size:14px;color:#16a34a;padding:4px 0">&#x1F3F7; Descuento (SUMMER10)</td><td style="font-size:14px;color:#16a34a;font-weight:600;text-align:right;padding:4px 0">- $ 800,00</td></tr>',
  desglose_items:  '<tr><td style="font-size:14px;color:#374151;padding:5px 0">Muñeca articulada premium &times; 1</td><td style="font-size:14px;color:#374151;text-align:right;padding:5px 0;font-weight:500;white-space:nowrap">$ 4.500,00</td></tr><tr><td style="font-size:14px;color:#374151;padding:5px 0">LEGO City Set 60303 &times; 2</td><td style="font-size:14px;color:#374151;text-align:right;padding:5px 0;font-weight:500;white-space:nowrap">$ 3.500,00</td></tr>',
  productos_filas: '<tr><td style="font-size:14px;color:#111;padding:12px 0;border-bottom:1px solid #f0f0f0">Muñeca articulada premium</td><td style="font-size:14px;color:#666;text-align:center;padding:12px 0;border-bottom:1px solid #f0f0f0">1</td><td style="font-size:14px;color:#111;text-align:right;padding:12px 0;border-bottom:1px solid #f0f0f0">$ 4.500,00</td></tr><tr><td style="font-size:14px;color:#111;padding:12px 0">LEGO City Set 60303</td><td style="font-size:14px;color:#666;text-align:center;padding:12px 0">2</td><td style="font-size:14px;color:#111;text-align:right;padding:12px 0">$ 3.500,00</td></tr>',
  // Despacho
  courier:         'OCA',
  tracking_numero: 'OCA-987654321',
  tracking_url:    'https://www.oca.com.ar/tracking',
  tracking_boton:  '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td align="center"><a href="https://www.oca.com.ar/tracking" style="display:inline-block;background:#7C3AED;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px">Ver seguimiento en vivo</a></td></tr></table>',
}

export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  let body: { email?: string; asunto?: string; cuerpo?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const { email, asunto, cuerpo } = body

  if (!email) return NextResponse.json({ error: 'Falta el campo email' }, { status: 400 })
  if (!asunto || !cuerpo) return NextResponse.json({ error: 'Faltan asunto o cuerpo' }, { status: 400 })

  try {
    // La página ya sustituye las vars de preview antes de enviar,
    // pero aplicamos renderTemplate por si quedó algún {{var}} sin reemplazar.
    const cuerpoRendered = renderTemplate(cuerpo, SAMPLE_VARS)
    const asuntoRendered = renderTemplate(asunto, SAMPLE_VARS)

    await sendEmail({ to: email, asunto: asuntoRendered, cuerpo: cuerpoRendered })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[mailing-test]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
