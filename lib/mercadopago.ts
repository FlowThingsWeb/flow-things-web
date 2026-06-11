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
}

export async function crearPreferencia({
  items,
  comprador,
  ordenId,
}: CreatePreferenceParams) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  const response = await preference.create({
    body: {
      items: items.map((item) => ({
        id: item.id,
        title: item.nombre,
        quantity: item.cantidad,
        unit_price: Number(item.precio),
        currency_id: 'ARS',
        picture_url: item.imagen_url || undefined,
      })),
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
