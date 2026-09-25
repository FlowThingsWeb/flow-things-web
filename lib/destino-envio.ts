'use client'

/**
 * Dónde vive el comprador, recordado entre páginas.
 *
 * El costo del envío es la duda número uno de una compra online, y en esta
 * tienda cambia mucho: a 2,7 km del local son $3.600 y llega en 48hs; al
 * interior son $15.000 y hasta 5 días. Pero el estimador de la ficha arrancaba
 * vacío en cada producto: había que elegir provincia, escribir el CP y apretar
 * "Calcular", producto por producto, y recién en el checkout —después de
 * cargar nombre, email, teléfono y DNI— el número aparecía solo.
 *
 * Guardando el destino una sola vez, la ficha puede contestar la pregunta
 * antes de que la vuelvan a hacer, y el checkout ya llega con los datos de
 * envío puestos.
 *
 * Qué se guarda: provincia, código postal y —sólo si lo escribieron en la
 * ficha para cotizar por distancia— la calle y el partido. Es lo mismo que el
 * comprador va a cargar en el checkout, vive únicamente en su navegador y no
 * viaja a ningún lado que no sea nuestra propia cotización de envío. No se
 * guarda nombre, teléfono, mail ni documento.
 */

const CLAVE = 'ft_destino_envio'

export interface DestinoEnvio {
  provincia: string
  cp: string
  /** Calle y altura. Se pide en CABA y AMBA, donde se cobra por distancia. */
  direccion?: string
  /** Partido del conurbano. Sólo en AMBA: en CABA la localidad es la provincia. */
  localidad?: string
}

export function leerDestino(): DestinoEnvio | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<DestinoEnvio>
    if (!d || typeof d.provincia !== 'string' || !d.provincia) return null
    return {
      provincia: d.provincia,
      cp: typeof d.cp === 'string' ? d.cp : '',
      direccion: typeof d.direccion === 'string' ? d.direccion : '',
      localidad: typeof d.localidad === 'string' ? d.localidad : '',
    }
  } catch {
    // localStorage puede estar bloqueado (modo privado, cookies de terceros).
    // Sin destino recordado el estimador funciona igual, sólo arranca vacío.
    return null
  }
}

export function guardarDestino(destino: DestinoEnvio): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CLAVE, JSON.stringify(destino))
  } catch {
    /* si no se puede guardar, no pasa nada: es una comodidad, no un dato */
  }
}
