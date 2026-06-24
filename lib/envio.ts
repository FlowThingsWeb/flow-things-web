/**
 * Lógica de cálculo de envío (compartida entre /api/envio/cotizar y /api/checkout).
 * Centralizar aquí evita que la lógica de precios se duplique.
 */
import { getConfig } from '@/lib/config'

const PROVINCIAS_CABA = ['CABA']
const PROVINCIAS_GBA  = ['Buenos Aires']

export function getZonaEnvio(provincia: string): 'caba' | 'gba' | 'interior' {
  if (PROVINCIAS_CABA.includes(provincia)) return 'caba'
  if (PROVINCIAS_GBA.includes(provincia))  return 'gba'
  return 'interior'
}

export interface OpcionEnvio {
  id: string
  nombre: string
  precio: number
  tiempo_estimado: string
  descripcion: string | null
}

/**
 * Calcula el costo de envío server-side a partir de la provincia y el subtotal.
 * Retorna `null` si la provincia no se puede determinar.
 */
export async function calcularEnvio(
  provincia: string | null | undefined,
  subtotal: number
): Promise<OpcionEnvio | null> {
  if (!provincia) return null

  const cfg = await getConfig()
  const zona = getZonaEnvio(provincia)

  const zonas = {
    caba: {
      precio:       Number(cfg.envio_precio_caba)              || 2500,
      gratis_desde: Number(cfg.envio_gratis_caba_desde)        || 40000,
      tiempo:       cfg.envio_tiempo_caba                      || '24-48 hs hábiles',
      nombre:       'Envío a CABA',
      id:           'caba',
    },
    gba: {
      precio:       Number(cfg.envio_precio_gba)               || 3500,
      gratis_desde: Number(cfg.envio_gratis_gba_desde)         || 60000,
      tiempo:       cfg.envio_tiempo_gba                       || '48-72 hs hábiles',
      nombre:       'Envío GBA / Provincia de Buenos Aires',
      id:           'gba',
    },
    interior: {
      precio:       Number(cfg.envio_precio_interior)          || 6000,
      gratis_desde: Number(cfg.envio_gratis_interior_desde)    || 120000,
      tiempo:       cfg.envio_tiempo_interior                  || '3-7 días hábiles',
      nombre:       'Envío al interior del país',
      id:           'interior',
    },
  }

  const opcion = zonas[zona]
  const esGratis = subtotal > 0 && subtotal >= opcion.gratis_desde
  const precioFinal = esGratis ? 0 : opcion.precio

  return {
    id:              opcion.id,
    nombre:          opcion.nombre,
    precio:          precioFinal,
    tiempo_estimado: opcion.tiempo,
    descripcion:     esGratis ? '¡Envío gratis por superar el mínimo!' : null,
  }
}
