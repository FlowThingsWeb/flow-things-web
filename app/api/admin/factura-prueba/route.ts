import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AfipModule = require('@afipsdk/afip.js')
const Afip = AfipModule.default ?? AfipModule

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

    // Entorno de HOMOLOGACIÓN (prueba) — production: false
    const afip = new Afip({ CUIT: cuit, cert, key, production: false })
    const fe = afip.ElectronicBilling

    const ultimoNro = await fe.getLastVoucher(ptoVenta, 11)
    const nroComprobante = ultimoNro + 1
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    const voucher = {
      CantReg: 1,
      PtoVta: ptoVenta,
      CbteTipo: 11,
      Concepto: 1,
      DocTipo: 99,
      DocNro: 0,
      CbteDesde: nroComprobante,
      CbteHasta: nroComprobante,
      CbteFch: fecha,
      ImpTotal: 1000.00,
      ImpTotConc: 0,
      ImpNeto: 1000.00,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      Iva: [],
    }

    const result = await fe.createNextVoucher(voucher)

    return NextResponse.json({
      ok: true,
      cae: result.CAE,
      caeFechaVto: result.CAEFchVto,
      nroComprobante,
      ptoVenta,
      fecha: new Date().toLocaleDateString('es-AR'),
      importe: '$1.000,00 (factura de prueba)',
      ambiente: 'HOMOLOGACIÓN',
    })
  } catch (err: any) {
    console.error('[factura-prueba]', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
