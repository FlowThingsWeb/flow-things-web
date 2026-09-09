import { supabaseAdmin } from './supabaseAdmin'

/**
 * Vigilante de los crons de precios.
 *
 * Avisa cuando un cron no corrió. Es el aviso que faltaba el 9/9/2026: ese día
 * no llegó ningún mail de precios y no hubo forma de enterarse hasta buscarlo
 * a mano, porque un cron que GitHub descarta no deja ni un run fallido.
 *
 * No se puede detectar por el mail ausente: de los avisos diarios, tres callan
 * a propósito cuando no hay novedades. Por eso cada cron deja su latido al
 * empezar y acá se compara contra lo esperado.
 */

export type CronVigilado = {
  clave: string
  nombre: string
  /** Hora UTC a la que está programado. */
  hora: number
  minuto: number
  /**
   * Cuántas horas se le perdonan antes de avisar.
   *
   * Generosa a propósito: GitHub viene demorando entre 2 y 5 horas. Avisar a la
   * hora sería avisar todos los días de algo que después llega igual, y un
   * aviso que casi siempre es falsa alarma se deja de leer — que es exactamente
   * como se perdió el día que sí importaba.
   */
  gracia: number
  /** Días de la semana en que corre (0=domingo). Vacío = todos. */
  dias?: number[]
}

export const CRONS_DE_PRECIOS: CronVigilado[] = [
  { clave: 'ciclo-promociones', nombre: 'Ciclo de promociones ML (CRM)', hora: 11, minuto: 9, gracia: 6 },
  { clave: 'avisar-ml', nombre: 'Avisar cambios de precios de ML', hora: 12, minuto: 13, gracia: 6 },
  { clave: 'precios-sugeridos', nombre: 'Precios sugeridos ML', hora: 12, minuto: 37, gracia: 6 },
  { clave: 'promociones-por-vencer', nombre: 'Promociones por vencer ML', hora: 12, minuto: 49, gracia: 6 },
  { clave: 'promociones-disponibles', nombre: 'Promociones disponibles ML', hora: 13, minuto: 11, gracia: 6 },
  // Semanal, los lunes.
  { clave: 'ajustar-precios', nombre: 'Ajustar precios de la tienda', hora: 11, minuto: 7, gracia: 8, dias: [1] },
]

/**
 * Deja constancia de que un cron corrió. Nunca rompe al cron que lo llama.
 *
 * Devuelve si realmente quedó registrado. El cliente de Supabase no tira
 * excepción: devuelve `{ error }` y sigue, así que sin mirarlo un latido que no
 * se guardó se ve idéntico a uno que sí. Y eso acá es grave: el vigilante
 * pasaría a avisar "no corrió" todos los días de un cron que corre perfecto, y
 * un aviso que siempre miente se deja de leer.
 */
export async function registrarLatido(clave: string, ok = true, detalle?: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('crons_corridas').upsert(
      {
        clave,
        ultima_corrida: new Date().toISOString(),
        ultimo_ok: ok,
        ultimo_detalle: detalle?.slice(0, 300) ?? null,
      },
      { onConflict: 'clave' },
    )
    if (error) {
      console.error(`[vigilar-crons] No se registró el latido de ${clave}:`, error.message)
      return false
    }
    return true
  } catch (e: any) {
    // El latido sirve para saber si el cron corrió; si falla el registro, el
    // cron tiene que seguir haciendo su trabajo igual. Se pierde la vigilancia
    // de esa corrida, no la corrida.
    console.error(`[vigilar-crons] No se registró el latido de ${clave}:`, e?.message ?? e)
    return false
  }
}

export type CronFaltante = {
  cron: CronVigilado
  /** Última vez que se lo vio, si alguna. */
  ultima: string | null
  motivo: 'nunca_corrio' | 'no_corrio_hoy' | 'corrio_con_error'
}

/**
 * Qué crons de precios deberían haber corrido ya hoy y no lo hicieron.
 *
 * "Hoy" se mide en UTC, igual que los cron de GitHub, para no tener que pensar
 * en el huso a las tres de la mañana de un domingo.
 */
export async function cronsFaltantes(ahora = new Date()): Promise<CronFaltante[]> {
  const { data, error } = await supabaseAdmin
    .from('crons_corridas')
    .select('clave, ultima_corrida, ultimo_ok')
  if (error) throw new Error(`No se pudo leer los latidos: ${error.message}`)

  const porClave = new Map((data ?? []).map(f => [f.clave, f]))
  const hoy = ahora.toISOString().slice(0, 10)
  const diaSemana = ahora.getUTCDay()

  const faltantes: CronFaltante[] = []
  for (const cron of CRONS_DE_PRECIOS) {
    if (cron.dias && !cron.dias.includes(diaSemana)) continue

    // ¿Ya pasó su horario más la gracia?
    const limite = new Date(ahora)
    limite.setUTCHours(cron.hora, cron.minuto, 0, 0)
    limite.setUTCHours(limite.getUTCHours() + cron.gracia)
    if (ahora < limite) continue

    const fila = porClave.get(cron.clave)
    if (!fila) {
      faltantes.push({ cron, ultima: null, motivo: 'nunca_corrio' })
    } else if (fila.ultima_corrida.slice(0, 10) !== hoy) {
      faltantes.push({ cron, ultima: fila.ultima_corrida, motivo: 'no_corrio_hoy' })
    } else if (!fila.ultimo_ok) {
      faltantes.push({ cron, ultima: fila.ultima_corrida, motivo: 'corrio_con_error' })
    }
  }
  return faltantes
}

/**
 * Prefijo con el que el vigilante anota de qué cron ya avisó, y qué día.
 *
 * Una marca POR CRON, no una sola para todos. Con una sola marca diaria pasaba
 * esto: los plazos vencen escalonados (18:37, 18:49, 19:11 UTC) y las pasadas
 * caen cada 1,7 a 5,2 horas. Una pasada a las 18:40 encontraba vencido sólo el
 * primero, avisaba de ése, quedaba marcada como "ya avisé hoy", y de los otros
 * dos no te enterabas hasta el día siguiente — justo el retraso que este
 * vigilante existe para eliminar.
 *
 * Va sobre la misma tabla: la clave es texto libre, así que estas marcas
 * conviven con los latidos sin cambiar el esquema. No coinciden con ninguna
 * clave de CRONS_DE_PRECIOS, así que el resto del código las ignora.
 */
export const PREFIJO_AVISO = '_aviso:'

/** De los faltantes, los que todavía no se avisaron hoy. */
export async function sinAvisarHoy(
  faltantes: CronFaltante[],
  ahora = new Date(),
): Promise<CronFaltante[]> {
  if (faltantes.length === 0) return []
  const hoy = ahora.toISOString().slice(0, 10)
  const claves = faltantes.map(f => PREFIJO_AVISO + f.cron.clave)

  const { data, error } = await supabaseAdmin
    .from('crons_corridas')
    .select('clave, ultima_corrida')
    .in('clave', claves)
  // Ante un error de lectura no se avisa: repetir el mismo aviso en cada pasada
  // lo convierte en ruido, y el ruido es cómo se pierde el aviso que importa.
  if (error) throw new Error(`No se pudo leer los avisos previos: ${error.message}`)

  const avisadosHoy = new Set(
    (data ?? []).filter(f => f.ultima_corrida.slice(0, 10) === hoy).map(f => f.clave),
  )
  return faltantes.filter(f => !avisadosHoy.has(PREFIJO_AVISO + f.cron.clave))
}

/** Deja anotado que ya se avisó de estos crons. */
export async function marcarAvisados(faltantes: CronFaltante[], ahora = new Date()): Promise<void> {
  if (faltantes.length === 0) return
  await supabaseAdmin.from('crons_corridas').upsert(
    faltantes.map(f => ({
      clave: PREFIJO_AVISO + f.cron.clave,
      ultima_corrida: ahora.toISOString(),
      ultimo_ok: true,
      ultimo_detalle: f.motivo,
    })),
    { onConflict: 'clave' },
  )
}

export function htmlDeFaltantes(faltantes: CronFaltante[]): string {
  const filas = faltantes
    .map(f => {
      const cuando = f.ultima
        ? new Date(f.ultima).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
        : 'nunca'
      const texto = {
        nunca_corrio: 'no corrió nunca',
        no_corrio_hoy: 'no corrió hoy',
        corrio_con_error: 'corrió pero terminó con error',
      }[f.motivo]
      const hh = String(f.cron.hora).padStart(2, '0')
      const mm = String(f.cron.minuto).padStart(2, '0')
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#111">${f.cron.nombre}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#b91c1c">${texto}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:#666;white-space:nowrap">${hh}:${mm} UTC</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:#666;white-space:nowrap">${cuando}</td>
      </tr>`
    })
    .join('')

  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px">
  <h2 style="font-size:18px;color:#111;margin:0 0 6px">Crons de precios que no corrieron</h2>
  <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 18px">
    Ya pasó el horario de estos crons más varias horas de tolerancia y no dejaron rastro de haber corrido.
    Casi siempre es GitHub demorando o descartando el <em>schedule</em>, no un error del código.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <th align="left" style="font-size:12px;color:#666;text-transform:uppercase;padding-bottom:6px">Cron</th>
      <th align="left" style="font-size:12px;color:#666;text-transform:uppercase;padding-bottom:6px">Qué pasó</th>
      <th align="left" style="font-size:12px;color:#666;text-transform:uppercase;padding-bottom:6px">Horario</th>
      <th align="left" style="font-size:12px;color:#666;text-transform:uppercase;padding-bottom:6px">Última vez</th>
    </tr>
    ${filas}
  </table>
  <p style="font-size:13px;color:#666;line-height:1.6;margin:20px 0 0">
    Se puede disparar a mano desde la pestaña Actions de cada repo, con "Run workflow".
  </p>
</div>`
}
