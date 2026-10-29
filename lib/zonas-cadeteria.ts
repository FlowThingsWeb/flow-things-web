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

/* ───────────────────────── Cuándo llega ───────────────────────── */

/** Después de esta hora de Buenos Aires, el paquete sale al día siguiente. */
export const HORA_CORTE = 13

/**
 * Cuando falta menos que esto para el corte, la promesa se condiciona.
 *
 * "Llega hoy" a las 12:58 es una promesa que el comprador no llega a cumplir:
 * entre que lee, carga la tarjeta y paga, pasaron las 13. Decirle la condición
 * en vez del resultado es lo único honesto, y además apura, que es lo que
 * quiere el que está por comprar.
 */
const MINUTOS_DE_AVISO = 60

const ZONA_AR = 'America/Argentina/Buenos_Aires'
const UN_DIA = 86_400_000
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function enBuenosAires(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const g = (t: Intl.DateTimeFormatPartTypes) => Number(p.find((x) => x.type === t)?.value ?? 0)
  return { y: g('year'), m: g('month'), d: g('day'), h: g('hour'), min: g('minute') }
}

const aISO = (t: number) => new Date(t).toISOString().slice(0, 10)

export interface EntregaCadeteria {
  /** Llega hoy. */
  hoy: boolean
  /** Lo que ve el comprador: "Llega hoy", "Llega mañana", "Llega el lunes". */
  etiqueta: string
  /** Día de entrega, `YYYY-MM-DD` en hora de Buenos Aires. */
  fecha: string
}

/**
 * Cuándo le llega al comprador si compra ahora.
 *
 * La regla del cadete: antes de las 13 de Buenos Aires sale —y llega— el mismo
 * día; después, al siguiente día que reparte. No reparte sábados, domingos ni
 * los feriados que estén cargados.
 *
 * La hora es SIEMPRE la de Buenos Aires y no la del visitante. Un comprador en
 * España abriendo la tienda a las 18 de allá son las 14 de acá: si la cuenta
 * saliera de su reloj, le prometeríamos una entrega que ya no entra.
 *
 * Los feriados vienen de afuera, no de una lista acá adentro: los movibles
 * cambian de fecha todos los años y una lista vieja en el código promete
 * entregas los días que nadie reparte. Se cargan en /admin/envios.
 *
 * El CRM tiene la misma regla en `despachoPrevisto` —dice "sale hoy", porque
 * del otro lado del mostrador lo que importa es cuándo se despacha—. Son dos
 * repos distintos; si la hora de corte cambia, hay que tocar las dos.
 */
export function entregaCadeteria(opts?: {
  feriados?: Iterable<string>
  ahora?: Date
}): EntregaCadeteria {
  const feriados = new Set(opts?.feriados ?? [])
  const ahora = enBuenosAires(opts?.ahora ?? new Date())
  const hoyCivil = Date.UTC(ahora.y, ahora.m - 1, ahora.d)

  let entrega = hoyCivil + (ahora.h >= HORA_CORTE ? UN_DIA : 0)
  // Fin de semana y feriado se saltan igual. El `while` avanza de a un día y
  // no de a uno solo: dos feriados pegados a un domingo son tres saltos.
  while (
    new Date(entrega).getUTCDay() === 0 ||
    new Date(entrega).getUTCDay() === 6 ||
    feriados.has(aISO(entrega))
  ) {
    entrega += UN_DIA
  }

  const dias = Math.round((entrega - hoyCivil) / UN_DIA)
  const minutosAlCorte = (HORA_CORTE - ahora.h) * 60 - ahora.min

  let etiqueta: string
  if (dias === 0) {
    etiqueta =
      minutosAlCorte <= MINUTOS_DE_AVISO
        ? `Llega hoy si comprás antes de las ${HORA_CORTE}`
        : 'Llega hoy'
  } else if (dias === 1) {
    etiqueta = 'Llega mañana'
  } else {
    etiqueta = `Llega el ${DIAS[new Date(entrega).getUTCDay()]}`
  }

  return { hoy: dias === 0, etiqueta, fecha: aISO(entrega) }
}

/** Los feriados tal como se guardan: fechas sueltas separadas por coma. */
export function parsearFeriados(texto?: string | null): string[] {
  return String(texto ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
}
