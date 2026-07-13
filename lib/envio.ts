/**
 * Lógica de cálculo de envío (compartida entre /api/envio/cotizar y /api/checkout).
 * Centralizar aquí evita que la lógica de precios se duplique.
 */
import { getConfig } from '@/lib/config'

export type ZonaEnvio = 'caba' | 'amba' | 'bsas' | 'interior'

/**
 * Partidos del AMBA (1er y 2do cordón del conurbano bonaerense) con sus rangos
 * de código postal de 4 dígitos. Se usa para separar el conurbano del resto de
 * la provincia de Buenos Aires.
 *
 * ⚠️ La Plata queda EXCLUIDA a propósito (Gran La Plata / 3er cordón) → cae en
 * "Resto de Buenos Aires". Para incluir o sacar un partido, editá esta lista.
 */
const AMBA_PARTIDOS: { partido: string; cordon: 1 | 2; cp: [number, number] }[] = [
  // ── 1er cordón ──
  { partido: 'Vicente López',       cordon: 1, cp: [1602, 1609] },
  { partido: 'San Isidro',          cordon: 1, cp: [1607, 1646] },
  { partido: 'General San Martín',  cordon: 1, cp: [1650, 1655] },
  { partido: 'Tres de Febrero',     cordon: 1, cp: [1670, 1688] },
  { partido: 'Morón',               cordon: 1, cp: [1704, 1708] },
  { partido: 'Hurlingham',          cordon: 1, cp: [1686, 1688] },
  { partido: 'Ituzaingó',           cordon: 1, cp: [1712, 1714] },
  { partido: 'La Matanza',          cordon: 1, cp: [1751, 1778] },
  { partido: 'Lanús',               cordon: 1, cp: [1822, 1832] },
  { partido: 'Lomas de Zamora',     cordon: 1, cp: [1828, 1838] },
  { partido: 'Avellaneda',          cordon: 1, cp: [1868, 1876] },
  // ── 2do cordón ──
  { partido: 'Tigre',               cordon: 2, cp: [1617, 1649] },
  { partido: 'San Fernando',        cordon: 2, cp: [1646, 1649] },
  { partido: 'Malvinas Argentinas', cordon: 2, cp: [1610, 1620] },
  { partido: 'José C. Paz',         cordon: 2, cp: [1665, 1667] },
  { partido: 'San Miguel',          cordon: 2, cp: [1661, 1667] },
  { partido: 'Moreno',              cordon: 2, cp: [1740, 1744] },
  { partido: 'Merlo',               cordon: 2, cp: [1722, 1730] },
  { partido: 'Ezeiza',              cordon: 2, cp: [1802, 1809] },
  { partido: 'Esteban Echeverría',  cordon: 2, cp: [1842, 1842] },
  { partido: 'Almirante Brown',     cordon: 2, cp: [1846, 1852] },
  { partido: 'Quilmes',             cordon: 2, cp: [1878, 1889] },
  { partido: 'Berazategui',         cordon: 2, cp: [1880, 1894] },
  { partido: 'Florencio Varela',    cordon: 2, cp: [1888, 1896] },
]

/** Extrae los 4 dígitos del CP, soportando formato viejo (1878) y CPA (B1878ABC). */
function parseCP(cp?: string | null): number | null {
  if (!cp) return null
  const m = String(cp).match(/\d{4}/)
  return m ? Number(m[0]) : null
}

/** True si el CP pertenece a algún partido del AMBA (1er/2do cordón). */
export function esAMBA(codigoPostal?: string | null): boolean {
  const n = parseCP(codigoPostal)
  if (n === null) return false
  return AMBA_PARTIDOS.some(({ cp }) => n >= cp[0] && n <= cp[1])
}

/**
 * Determina la zona de envío a partir de la provincia y el código postal.
 * - CABA → caba
 * - Buenos Aires + CP del conurbano (1er/2do cordón) → amba
 * - Buenos Aires + resto → bsas
 * - Otras provincias → interior
 *
 * Si viene provincia Buenos Aires sin CP identificable, cae en 'bsas' (resto)
 * para no aplicar por error la tarifa AMBA.
 */
export function getZonaEnvio(provincia: string, codigoPostal?: string | null): ZonaEnvio {
  if (provincia === 'CABA') return 'caba'
  if (provincia === 'Buenos Aires') return esAMBA(codigoPostal) ? 'amba' : 'bsas'
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
 * Calcula el costo de envío server-side a partir de la provincia, el subtotal y
 * el código postal (necesario para distinguir AMBA del resto de Buenos Aires).
 * Retorna `null` si la provincia no se puede determinar.
 */
export async function calcularEnvio(
  provincia: string | null | undefined,
  subtotal: number,
  codigoPostal?: string | null
): Promise<OpcionEnvio | null> {
  if (!provincia) return null

  const cfg = await getConfig()
  const zona = getZonaEnvio(provincia, codigoPostal)

  // Compat: el valor viejo 'gba' (cuando toda la provincia era una sola zona)
  // se usa como fallback para AMBA y Resto BA hasta que se configuren aparte.
  const num = (v: string | undefined, def: number) => Number(v) || def

  const zonas: Record<ZonaEnvio, { precio: number; gratis_desde: number; tiempo: string; nombre: string; id: string }> = {
    caba: {
      precio:       num(cfg.envio_precio_caba, 2500),
      gratis_desde: num(cfg.envio_gratis_caba_desde, 40000),
      tiempo:       cfg.envio_tiempo_caba || '24-48 hs hábiles',
      nombre:       'Envío a CABA',
      id:           'caba',
    },
    amba: {
      precio:       num(cfg.envio_precio_amba ?? cfg.envio_precio_gba, 3500),
      gratis_desde: num(cfg.envio_gratis_amba_desde ?? cfg.envio_gratis_gba_desde, 60000),
      tiempo:       cfg.envio_tiempo_amba || cfg.envio_tiempo_gba || '48-72 hs hábiles',
      nombre:       'Envío AMBA (Gran Buenos Aires)',
      id:           'amba',
    },
    bsas: {
      precio:       num(cfg.envio_precio_bsas ?? cfg.envio_precio_gba, 5000),
      gratis_desde: num(cfg.envio_gratis_bsas_desde ?? cfg.envio_gratis_gba_desde, 90000),
      tiempo:       cfg.envio_tiempo_bsas || '3-5 días hábiles',
      nombre:       'Envío Provincia de Buenos Aires',
      id:           'bsas',
    },
    interior: {
      precio:       num(cfg.envio_precio_interior, 6000),
      gratis_desde: num(cfg.envio_gratis_interior_desde, 120000),
      tiempo:       cfg.envio_tiempo_interior || '3-7 días hábiles',
      nombre:       'Envío al interior del país',
      id:           'interior',
    },
  }

  const opcion = zonas[zona]
  const esGratis = subtotal > 0 && opcion.gratis_desde > 0 && subtotal >= opcion.gratis_desde
  const precioFinal = esGratis ? 0 : opcion.precio

  return {
    id:              opcion.id,
    nombre:          opcion.nombre,
    precio:          precioFinal,
    tiempo_estimado: opcion.tiempo,
    descripcion:     esGratis ? '¡Envío gratis por superar el mínimo!' : null,
  }
}
