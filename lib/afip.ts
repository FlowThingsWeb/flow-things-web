import { getTokenAuth } from './afip-wsaa'
import { getLastVoucher, solicitarCAE } from './afip-wsfe'

export interface DatosFactura {
  nombre: string
  email: string
  total: number
  items: { nombre: string; cantidad: number; precio: number }[]
}

export async function emitirFacturaC(datos: DatosFactura): Promise<{
  cae: string
  caeFechaVto: string
  nroComprobante: number
  fecha: string
}> {
  const cert = (process.env.AFIP_CERT || '').replace(/\\n/g, '\n')
  const key = (process.env.AFIP_KEY || '').replace(/\\n/g, '\n')
  const cuit = Number(process.env.AFIP_CUIT)
  const ptoVenta = Number(process.env.AFIP_PTO_VENTA || 5)

  if (!cert || !key || !cuit) {
    throw new Error('Faltan variables AFIP_CERT, AFIP_KEY o AFIP_CUIT')
  }

  const { token, sign } = await getTokenAuth('wsfe', cert, key)
  const ultimoNro = await getLastVoucher(token, sign, cuit, ptoVenta, 11)
  const nroComprobante = ultimoNro + 1

  const result = await solicitarCAE(token, sign, cuit, ptoVenta, nroComprobante, datos.total)

  return {
    cae: result.cae,
    caeFechaVto: result.caeFechaVto,
    nroComprobante: result.nroComprobante,
    fecha: new Date().toLocaleDateString('es-AR'),
  }
}
