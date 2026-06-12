import Afip from 'afipjs'

let _afip: Afip | null = null

function getAfip(): Afip {
  if (_afip) return _afip

  const cert = (process.env.AFIP_CERT || '').replace(/\\n/g, '\n')
  const key = (process.env.AFIP_KEY || '').replace(/\\n/g, '\n')
  const cuit = Number(process.env.AFIP_CUIT)

  if (!cert || !key || !cuit) {
    throw new Error('Faltan variables de entorno AFIP_CERT, AFIP_KEY o AFIP_CUIT')
  }

  _afip = new Afip({ CUIT: cuit, cert, key, production: true })
  return _afip
}

export interface DatosFactura {
  nombre: string
  email: string
  total: number // en pesos, con decimales
  items: { nombre: string; cantidad: number; precio: number }[]
}

export async function emitirFacturaC(datos: DatosFactura): Promise<{
  cae: string
  caeFechaVto: string
  nroComprobante: number
  fecha: string
}> {
  const afip = getAfip()
  const fe = afip.ElectronicBilling

  // Punto de venta
  const ptoVenta = Number(process.env.AFIP_PTO_VENTA || 5)

  // Último comprobante emitido
  const ultimoNro = await fe.getLastVoucher(ptoVenta, 11) // 11 = Factura C
  const nroComprobante = ultimoNro + 1

  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  const importeNeto = Math.round(datos.total * 100) / 100

  const voucher = {
    CantReg: 1,
    PtoVta: ptoVenta,
    CbteTipo: 11, // Factura C
    Concepto: 1, // Productos
    DocTipo: 99, // Consumidor final
    DocNro: 0,
    CbteDesde: nroComprobante,
    CbteHasta: nroComprobante,
    CbteFch: fecha,
    ImpTotal: importeNeto,
    ImpTotConc: 0,
    ImpNeto: importeNeto,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    Iva: [],
  }

  const result = await fe.createNextVoucher(voucher)

  return {
    cae: result.CAE,
    caeFechaVto: result.CAEFchVto,
    nroComprobante,
    fecha: new Date().toLocaleDateString('es-AR'),
  }
}
