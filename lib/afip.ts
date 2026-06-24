import { getTokenAuth } from './afip-wsaa'
import { emitirFactura } from './afip-wsfe'

export interface DatosFactura {
  nombre: string
  email: string
  total: number
  items: { nombre: string; cantidad: number; precio: number }[]
  /** DNI del comprador. Si se provee, AFIP lo registra con DocTipo 96 (DNI).
   *  Sin DNI usa DocTipo 99 (Consumidor Final). */
  dni?: string
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
  // emitirFactura encapsula getLastVoucher + solicitarCAE con reintento automático
  // para evitar race conditions en webhooks concurrentes.
  const result = await emitirFactura(token, sign, cuit, ptoVenta, datos.total, datos.dni)

  return {
    cae: result.cae,
    caeFechaVto: result.caeFechaVto,
    nroComprobante: result.nroComprobante,
    fecha: new Date().toLocaleDateString('es-AR'),
  }
}
