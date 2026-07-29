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
  /** Costo de envío. Se manda a MP en el campo `shipments` (no como ítem),
   *  así lo muestra como "Envío" separado en el checkout. */
  costoEnvio?: number
}

export async function crearPreferencia({
  items,
  comprador,
  ordenId,
  totalConDescuento,
  costoEnvio = 0,
}: CreatePreferenceParams) {
  // Garantizar que la URL tenga esquema https:// (requerido por MercadoPago)
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL!
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

  // Si hay descuento, colapsar a un único ítem para evitar precios negativos
  // MP pide items.description para su motor anti-fraude (mejora la tasa de
  // aprobación). Para productos usamos el nombre; para el envío un texto fijo.
  const mpItems = totalConDescuento != null
    ? [{
        id: 'orden',
        title: 'Compra en Flow Things',
        description: 'Compra en Flow Things',
        quantity: 1,
        unit_price: totalConDescuento,
        currency_id: 'ARS',
      }]
    : items.map((item) => ({
        id: item.id,
        title: item.nombre,
        description: item.id === 'envio' ? 'Costo de envío' : item.nombre,
        quantity: item.cantidad,
        unit_price: Number(item.precio),
        currency_id: 'ARS',
        picture_url: item.imagen_url || undefined,
      }))

  // Vigencia del link de pago: válido desde ahora y por 48h. Evita que un
  // link viejo (mail, WhatsApp) se pague días después con precio/stock ya
  // cambiado. Para el cupón de efectivo, MP usa esta misma fecha de
  // vencimiento (date_of_expiration).
  const ahora = new Date()
  const vence = new Date(ahora.getTime() + 48 * 60 * 60 * 1000)

  // Envío como `shipments.cost` (no como ítem): MP lo muestra separado como
  // "Envío". Si hay descuento, el envío ya está dentro del ítem único colapsado
  // (total con descuento), así que no lo sumamos de nuevo acá.
  const shipments =
    totalConDescuento == null && costoEnvio > 0
      ? { cost: Number(costoEnvio), mode: 'not_specified' as const }
      : undefined

  const response = await preference.create({
    body: {
      items: mpItems,
      ...(shipments ? { shipments } : {}),
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
      // Vigencia de la preferencia (ventana en la que el link es pagable).
      expires: true,
      expiration_date_from: ahora.toISOString(),
      expiration_date_to: vence.toISOString(),
      // Vencimiento del cupón de pago en efectivo (Rapipago/Pago Fácil).
      date_of_expiration: vence.toISOString(),
    },
  })

  return response
}
