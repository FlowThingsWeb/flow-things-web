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
const GEO_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

/** Una dirección ya resuelta por Google, con de dónde dice que es. */
export interface UbicacionGeo {
  lat: number
  lng: number
  /** administrative_area_level_1: la provincia (o CABA). */
  provincia: string | null
  /** administrative_area_level_2: el partido, en provincia de Buenos Aires. */
  partido: string | null
  localidad: string | null
  codigo_postal: string | null
  /**
   * Google avisa así que no pudo matchear la dirección tal cual se la pasaron
   * y devolvió lo más parecido que encontró. Para cotizar un envío eso no
   * sirve: "lo más parecido" puede estar en otro partido.
   */
  parcial: boolean
}

/**
 * Resuelve una dirección de texto a coordenadas, devolviendo además de dónde
 * dice Google que es.
 *
 * Existe porque Distance Matrix acepta texto pero no informa qué entendió: le
 * pasás "Av. San Martín 2000, Florencio Varela" y te devuelve 3 km sin
 * aclarar que resolvió la Av. San Martín de CABA. Geocodificar primero deja
 * verificar la jurisdicción antes de creerle a la distancia.
 */
export async function geocodificar(direccion: string): Promise<UbicacionGeo | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key || !direccion?.trim()) return null

  const url =
    `${GEO_URL}?address=${encodeURIComponent(direccion)}` +
    `&region=ar&language=es&key=${key}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.error('[google-maps] geocode HTTP', res.status)
      return null
    }
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.[0]) {
      // ZERO_RESULTS es un resultado válido: la dirección no existe.
      if (data.status !== 'ZERO_RESULTS') {
        console.error('[google-maps] geocode status', data.status, data.error_message ?? '')
      }
      return null
    }

    const r = data.results[0]
    const loc = r.geometry?.location
    if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null

    const comp = (tipo: string): string | null =>
      (r.address_components ?? []).find((c: { types: string[] }) => c.types?.includes(tipo))
        ?.long_name ?? null

    return {
      lat: loc.lat,
      lng: loc.lng,
      provincia: comp('administrative_area_level_1'),
      partido: comp('administrative_area_level_2'),
      localidad: comp('locality') ?? comp('sublocality') ?? null,
      codigo_postal: comp('postal_code'),
      parcial: r.partial_match === true,
    }
  } catch (err) {
    console.error('[google-maps] geocode error', err instanceof Error ? err.message : err)
    return null
  }
}

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
