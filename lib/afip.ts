import { getTokenAuth } from './afip-wsaa'
import { emitirFactura } from './afip-wsfe'
import { decodeAfipPem } from './afip-pem'

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
  const cert = decodeAfipPem(process.env.AFIP_CERT)
  const key = decodeAfipPem(process.env.AFIP_KEY)
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

/** Nota de Crédito C. Es el tipo que corresponde a la Factura C (11). */
export const CBTE_TIPO_NC_C = 13

export interface DatosNotaCredito {
  /** Total a acreditar. Hoy siempre el total de la orden: no hay NC parcial. */
  total: number
  dni?: string
  /** La factura que esta NC anula, tal como la emitió la tienda. */
  facturaOrigen: {
    nro: number
    /** AAAAMMDD. Opcional: AFIP la valida contra lo que tiene registrado. */
    fecha?: string
  }
}

/**
 * Emite una Nota de Crédito C contra la factura de una orden.
 *
 * Va por el mismo punto de venta y el mismo certificado que la factura
 * original, que es la única forma de que el comprobante asociado cierre: un
 * punto de venta declarado para web service no se puede usar desde
 * "Comprobantes en línea", así que una NC hecha a mano quedaría en otra serie.
 */
export async function emitirNotaCreditoC(datos: DatosNotaCredito): Promise<{
  cae: string
  caeFechaVto: string
  nroComprobante: number
  ptoVenta: number
  fecha: string
}> {
  const cert = decodeAfipPem(process.env.AFIP_CERT)
  const key = decodeAfipPem(process.env.AFIP_KEY)
  const cuit = Number(process.env.AFIP_CUIT)
  const ptoVenta = Number(process.env.AFIP_PTO_VENTA || 5)

  if (!cert || !key || !cuit) {
    throw new Error('Faltan variables AFIP_CERT, AFIP_KEY o AFIP_CUIT')
  }

  const { token, sign } = await getTokenAuth('wsfe', cert, key)
  const result = await emitirFactura(token, sign, cuit, ptoVenta, datos.total, datos.dni, 2, {
    cbteTipo: CBTE_TIPO_NC_C,
    cbtesAsoc: [
      {
        tipo: 11,
        ptoVenta,
        nro: datos.facturaOrigen.nro,
        ...(datos.facturaOrigen.fecha ? { fecha: datos.facturaOrigen.fecha } : {}),
      },
    ],
  })

  return {
    cae: result.cae,
    caeFechaVto: result.caeFechaVto,
    nroComprobante: result.nroComprobante,
    ptoVenta,
    fecha: new Date().toLocaleDateString('es-AR'),
  }
}
