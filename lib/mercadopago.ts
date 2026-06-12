import MercadoPagoConfig, { Preference } from 'mercadopago'
import { ItemOrden, DatosComprador } from '@/types'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export const preference = new Preference(client)

export interface CreatePreferenceParams {
  items: ItemOrden[]
  comprador: DatosComprador
  ordenId: string
  /** Si hay descuento, pasar el total final ya calculado para usar un ítem único.
   *  MercadoPago no acepta unit_price negativo, así que no se pueden pasar descuentos como ítems. */
  totalConDescuento?: number
}

export async function crearPreferencia({
  items,
  comprador,
  ordenId,
  totalConDescuento,
}: CreatePreferenceParams) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Si hay descuento, colapsar a un único ítem para evitar precios negativos
  const mpItems = totalConDescuento != null
    ? [{
        id: 'orden',
        title: 'Compra en Flow Things',
        quantity: 1,
        unit_price: totalConDescuento,
        currency_id: 'ARS',
      }]
    : items.map((item) => ({
        id: item.id,
        title: item.nombre,
        quantity: item.cantidad,
        unit_price: Number(item.precio),
        currency_id: 'ARS',
        picture_url: item.imagen_url || undefined,
      }))

  const response = await preference.create({
    body: {
      items: mpItems,
      payer: {
        name: comprador.nombre.split(' ')[0],
        surname: comprador.nombre.split(' ').slice(1).join(' '),
        email: comprador.email,
        phone: { number: comprador.telefono },
        address: {
          street_name: comprador.direccion,
          zip_code: comprador.codigo_postal,
        },
      },
      back_urls: {
        success: `${baseUrl}/exito?orden_id=${ordenId}`,
        failure: `${baseUrl}/carrito?error=pago_rechazado`,
        pending: `${baseUrl}/exito?orden_id=${ordenId}&pending=true`,
      },
      auto_return: 'approved',
      notification_url: `${baseUrl}/api/webhook`,
      external_reference: ordenId,
      statement_descriptor: 'Flow Things',
    },
  })

  return response
}
