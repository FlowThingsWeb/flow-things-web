/**
 * Helpers server-side de Google Maps para el envío por cercanía.
 *
 * Usa la key de SERVIDOR (GOOGLE_MAPS_API_KEY), distinta de la pública del mapa.
 * Restringila en Google Cloud a Geocoding API + Distance Matrix API.
 *
 * El cálculo de distancia se hace SIEMPRE en el servidor (no se confía en
 * coordenadas del cliente): así el costo de envío no se puede falsear.
 */

const DM_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'

/**
 * Distancia de manejo (en km) entre dos direcciones/coordenadas, vía Google
 * Distance Matrix. `origen` y `destino` pueden ser una dirección de texto
 * ("Av. Corrientes 1234, CABA, Argentina") o "lat,lng".
 *
 * Devuelve null si no hay API key, si la API falla, o si no hay ruta
 * (dirección inexistente / sin conexión vial). El llamador decide el fallback.
 */
export async function distanciaManejoKm(
  origen: string,
  destino: string
): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key || !origen?.trim() || !destino?.trim()) return null

  const url =
    `${DM_URL}?units=metric&mode=driving` +
    `&origins=${encodeURIComponent(origen)}` +
    `&destinations=${encodeURIComponent(destino)}` +
    `&region=ar&language=es&key=${key}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.error('[google-maps] distance matrix HTTP', res.status)
      return null
    }
    const data = await res.json()
    if (data.status !== 'OK') {
      console.error('[google-maps] distance matrix status', data.status, data.error_message ?? '')
      return null
    }
    const el = data.rows?.[0]?.elements?.[0]
    if (!el || el.status !== 'OK' || typeof el.distance?.value !== 'number') {
      // ZERO_RESULTS / NOT_FOUND: dirección no ubicable.
      return null
    }
    return el.distance.value / 1000 // metros → km
  } catch (err) {
    console.error('[google-maps] distance matrix error', err instanceof Error ? err.message : err)
    return null
  }
}
