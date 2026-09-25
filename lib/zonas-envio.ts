/**
 * En qué zona de envío cae una dirección. Sin dependencias: esto lo necesitan
 * tanto el servidor (para cotizar) como la ficha de producto (para saber si
 * pedir la calle), y `lib/envio` no se puede importar desde el navegador
 * porque arrastra la configuración y el cliente de Google Maps.
 *
 * `lib/envio` lo reexporta, así que nada de lo que ya importaba de ahí cambia.
 */

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

/**
 * Las zonas donde el envío se cobra por kilómetros y no por tarifa plana.
 *
 * Es la lista que decide si vale la pena pedirle la dirección al comprador:
 * en el resto del país el dato no cambiaría el precio.
 */
export function seCobraPorDistancia(zona: ZonaEnvio): boolean {
  return zona === 'caba' || zona === 'amba'
}
