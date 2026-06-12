import { NextRequest, NextResponse } from 'next/server'
import { getTokenAuth } from '@/lib/afip-wsaa'
import { getLastVoucher, solicitarCAE } from '@/lib/afip-wsfe'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
  } catch (err: any) {
    console.error('[factura-prueba]', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
