/**
 * El interruptor de las Ofertas Cyber.
 *
 * Una sola pregunta —¿está corriendo la promo?— contestada en un solo lugar,
 * porque la respuesta la van a necesitar cosas que no se parecen en nada: la
 * barra de arriba, la home, la grilla, y el cron que ajusta precios y que
 * durante la promo no tiene que tocar nada.
 *
 * Hay fecha de arranque y NO hay fecha de fin, y es a propósito. El arranque
 * se programa porque se sabe de antemano (el lunes a las 00:00, mientras uno
 * duerme); el final no se sabe: depende de cómo venga la venta. Una fecha de
 * fin inventada apaga la promo sola un martes a la noche en medio de un pico,
 * o —peor— la deja prendida porque alguien la puso mal. Se apaga a mano, que
 * es una decisión, no un olvido.
 */

const ZONA_AR = 'America/Argentina/Buenos_Aires'

/**
 * El instante, leído con el reloj de Buenos Aires.
 *
 * El servidor corre en UTC y el visitante puede estar en cualquier lado. La
 * promo arranca cuando son las 00:00 ACÁ, así que el único reloj que vale es
 * el del local.
 */
function minutosEnBuenosAires(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const g = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

/**
 * La fecha de arranque, normalizada a "AAAA-MM-DDTHH:mm".
 *
 * Acepta el día solo ("2026-11-02", que arranca a las 00:00) o el día con
 * hora ("2026-11-02T09:00"). Cualquier otra cosa devuelve null y la promo
 * arranca apenas se prende el interruptor: un campo mal escrito no puede
 * dejar la promo prendida pero invisible, que es el error que más tarda en
 * descubrirse.
 */
export function parsearDesde(texto?: string | null): string | null {
  const t = (texto ?? '').trim()
  if (!t) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(t)
  if (!m) return null
  const [, y, mes, d, h, min] = m
  const mesN = Number(mes)
  const diaN = Number(d)
  const horaN = Number(h ?? '0')
  const minN = Number(min ?? '0')
  if (mesN < 1 || mesN > 12 || diaN < 1 || diaN > 31) return null
  if (horaN > 23 || minN > 59) return null
  return `${y}-${mes}-${d}T${String(horaN).padStart(2, '0')}:${String(minN).padStart(2, '0')}`
}

export interface EstadoCyber {
  /** Está corriendo ahora mismo: el interruptor está en 1 y la fecha ya pasó. */
  activo: boolean
  /** El interruptor está en 1 pero todavía no llegó la fecha de arranque. */
  programado: boolean
  /** Cuándo arranca, ya normalizado. Null si arranca apenas se prende. */
  desde: string | null
  titulo: string
  bajada: string
}

/**
 * En qué estado está la promo.
 *
 * Se devuelve `programado` aparte de `activo` porque no son lo mismo para
 * quien mira el panel: "apagado" y "prendido pero arranca el lunes" se
 * parecen desde afuera —la tienda se ve igual— y son situaciones opuestas.
 * Sin esa distinción, el lunes a la mañana no hay forma de saber si la promo
 * va a salir sola o si alguien se olvidó de prenderla.
 */
export function estadoCyber(
  cfg: Record<string, string | undefined>,
  ahora: Date = new Date(),
): EstadoCyber {
  const prendido = cfg.cyber_activo === '1'
  const desde = parsearDesde(cfg.cyber_desde)
  const llegó = !desde || minutosEnBuenosAires(ahora) >= desde

  return {
    activo: prendido && llegó,
    programado: prendido && !llegó,
    desde,
    titulo: cfg.cyber_titulo || 'Ofertas Cyber',
    bajada: cfg.cyber_bajada || '',
  }
}

/** Atajo para el caso más común: ¿se muestra la promo? */
export function cyberActivo(
  cfg: Record<string, string | undefined>,
  ahora: Date = new Date(),
): boolean {
  return estadoCyber(cfg, ahora).activo
}
