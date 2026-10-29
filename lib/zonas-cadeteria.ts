/**
 * Envío en el día: a qué zona del cadete cae un código postal.
 *
 * Sin dependencias, igual que `lib/zonas-envio`: esto lo necesita el servidor
 * para cotizar y la ficha de producto para saber qué pedirle al comprador.
 *
 * Son los 781 códigos postales que cubre el servicio, guardados como rangos
 * contiguos para que la lista quepa en una pantalla. Los rangos salen de la
 * lista real de localidades, no de redondear: se armaron pegando sólo códigos
 * consecutivos, así que no hay un solo CP adentro de un rango que el cadete no
 * cubra. Y ninguno aparece en dos zonas.
 *
 * El nombre de la localidad NO está acá a propósito. Para cotizar alcanza la
 * zona, y mantener 231 nombres sincronizados con el CRM —donde sí están, en
 * `envio_localidades`— era garantizar que un día digan cosas distintas.
 */

export type ZonaCadeteria = 'caba' | 'zona1' | 'zona2' | 'zona3'

/** Cómo se llama cada zona cuando hay que mostrarla. */
export const NOMBRE_ZONA_CADETERIA: Record<ZonaCadeteria, string> = {
  caba: 'CABA',
  zona1: 'Zona 1',
  zona2: 'Zona 2',
  zona3: 'Zona 3',
}

const RANGOS: Record<ZonaCadeteria, [number, number][]> = {
  caba: [
    [1000,1499]
  ],
  zona1: [
    [1602,1607], [1609,1609], [1636,1638], [1640,1647], [1650,1651], [1653,1653],
    [1655,1655], [1657,1657], [1672,1672], [1674,1676], [1678,1678], [1682,1692],
    [1702,1704], [1706,1708], [1712,1715], [1751,1754], [1766,1766], [1768,1768],
    [1770,1770], [1820,1828], [1832,1832], [1834,1834], [1836,1836], [1868,1875]
  ],
  zona2: [
    [1601,1601], [1608,1608], [1610,1618], [1621,1621], [1624,1624], [1648,1648],
    [1659,1663], [1665,1667], [1716,1716], [1718,1718], [1721,1724], [1736,1736],
    [1738,1740], [1742,1746], [1755,1755], [1757,1759], [1761,1761], [1763,1765],
    [1771,1772], [1774,1774], [1776,1776], [1778,1778], [1785,1785], [1801,1807],
    [1812,1812], [1833,1833], [1837,1857], [1859,1861], [1863,1863], [1867,1867],
    [1876,1893]
  ],
  zona3: [
    [1619,1620], [1622,1623], [1625,1635], [1639,1639], [1649,1649], [1664,1664],
    [1669,1671], [1727,1727], [1747,1750], [1780,1784], [1787,1793], [1808,1808],
    [1814,1816], [1835,1835], [1858,1858], [1862,1862], [1864,1866], [1894,1898],
    [1900,1910], [1912,1912], [1914,1914], [1916,1916], [1918,1918], [1923,1927],
    [1929,1929], [1931,1931], [1933,1933], [1935,1935], [1942,1942], [1972,1972],
    [1980,1981], [1983,1984], [1986,1986], [2800,2800], [2802,2805], [2807,2807],
    [2814,2814], [6601,6601], [6608,6608], [6700,6703], [6706,6706], [6708,6708],
    [6712,6712], [7221,7221]
  ],
}

/**
 * Los cuatro dígitos de un código postal.
 *
 * Soporta el formato viejo (1878) y el CPA (B1878ABC, C1425DKE). Una corrida
 * de cinco dígitos no se recorta a cuatro: es un dato que no se entiende, y
 * adivinar ahí sería cobrarle a alguien el envío de otra zona.
 */
function parseCP(cp?: string | null): number | null {
  const m = String(cp ?? '').toUpperCase().match(/(?<!\d)(\d{4})(?!\d)/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1000 && n <= 9999 ? n : null
}

/** La zona del cadete para un CP, o null si el servicio no llega ahí. */
export function getZonaCadeteria(codigoPostal?: string | null): ZonaCadeteria | null {
  const n = parseCP(codigoPostal)
  if (n === null) return null
  for (const zona of Object.keys(RANGOS) as ZonaCadeteria[]) {
    if (RANGOS[zona].some(([a, b]) => n >= a && n <= b)) return zona
  }
  return null
}
