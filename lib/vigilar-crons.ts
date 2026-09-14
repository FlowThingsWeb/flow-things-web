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
  // Corre último, después de que el ciclo del CRM actualizó los precios de ML.
  // Gracia de 8 y no 6: históricamente es el que más tarde llegó (hasta 6h50).
  { clave: 'ajustar-precios', nombre: 'Ajustar precios de la tienda', hora: 13, minuto: 23, gracia: 8 },
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

/**
 * Salud de la conexión con Mercado Libre, preguntada al CRM.
 *
 * Un token vencido no es problema: cada llamada del CRM lo renueva sola cuando
 * le quedan menos de 30 minutos. El problema es que la RENOVACIÓN falle
 * —refresh_token revocado, credenciales cambiadas— porque ahí se cae todo lo de
 * ML junto y el motivo queda anotado en una columna que no mira nadie.
 *
 * Sin esto, de una renovación rota nos enteraríamos recién cuando falle el
 * ciclo del día siguiente. Con esto, en la primera pasada.
 */
export type SaludML = {
  sano: boolean
  /**
   * Si se pudo hablar con el CRM.
   *
   * Separa dos cosas que se veían iguales y no lo son: que el CRM diga "la
   * integración está rota" —que es real y no se arregla solo— de que el CRM no
   * conteste —que puede ser un arranque en frío, un hipo de Supabase o un
   * pestañeo de Vercel—. El 14/9/2026 el vigilante mandó "la conexión con
   * Mercado Libre está rota" por UN 500 pasajero, con el token renovado hacía
   * cuatro horas y last_error en null. A los crons se les dan 6 a 8 horas de
   * tolerancia por esto mismo; acá no había ninguna.
   */
  alcanzado: boolean
  problemas: string[]
  ultima_renovacion: string | null
  /** Cuándo corrió por última vez el ciclo del CRM, según sus propios datos. */
  ciclo_ultima_corrida: string | null
}

/** Reintentos cortos antes de dar por caído al CRM. */
const INTENTOS_SALUD = 3
const ESPERA_ENTRE_INTENTOS = [0, 1_500, 4_000]

export async function revisarSaludML(): Promise<SaludML | null> {
  const url = process.env.CRM_URL
  const secreto = process.env.CRM_SECRET
  // Sin CRM configurado no hay nada que vigilar, y no es una falla que avisar:
  // avisar de esto todos los días taparía los avisos que sí importan.
  if (!url || !secreto) return null

  let ultimoMotivo = 'sin intentos'
  for (let i = 0; i < INTENTOS_SALUD; i++) {
    if (ESPERA_ENTRE_INTENTOS[i]) {
      await new Promise(r => setTimeout(r, ESPERA_ENTRE_INTENTOS[i]))
    }
    try {
      const r = await fetch(`${url}/api/integraciones/salud-ml`, {
        headers: { Authorization: `Bearer ${secreto}` },
        signal: AbortSignal.timeout(15_000),
      })
      if (r.ok) {
        const d = await r.json()
        return {
          sano: d.sano === true,
          alcanzado: true,
          problemas: Array.isArray(d.problemas) ? d.problemas.map(String) : [],
          ultima_renovacion: d.ultima_renovacion ?? null,
          ciclo_ultima_corrida: d.ciclo_ultima_corrida ?? null,
        }
      }
      // El cuerpo suele traer el motivo; sin él, "500" no dice nada accionable.
      const cuerpo = await r.text().catch(() => '')
      ultimoMotivo = `contestó ${r.status}${cuerpo ? `: ${cuerpo.slice(0, 200)}` : ''}`
    } catch (e: any) {
      ultimoMotivo = `no contestó: ${e?.message ?? e}`
    }
  }

  return {
    sano: false,
    alcanzado: false,
    problemas: [`tras ${INTENTOS_SALUD} intentos, el CRM ${ultimoMotivo}`],
    ultima_renovacion: null,
    ciclo_ultima_corrida: null,
  }
}

/**
 * Anota el latido del ciclo con la fecha que informa el CRM.
 *
 * El ciclo corre en el CRM, así que su latido no lo puede poner él mismo: lo
 * intentó empujando a /api/cron/latido y no llegaba nunca —secreto distinto,
 * 401 tapado por un `|| true`— y el vigilante avisó cuatro días seguidos que
 * no corría mientras corría bien.
 *
 * Ahora la fecha viene del dato: el ciclo escribe en sus tablas cada vez que
 * trabaja. Se guarda esa fecha y no `now()`, porque lo que importa es cuándo
 * corrió el ciclo, no cuándo lo miramos.
 */
export async function sincronizarLatidoCiclo(cuando: string | null): Promise<void> {
  if (!cuando) return
  try {
    const { data } = await supabaseAdmin
      .from('crons_corridas')
      .select('ultima_corrida')
      .eq('clave', 'ciclo-promociones')
      .maybeSingle()
    if (data?.ultima_corrida && data.ultima_corrida >= cuando) return
    await supabaseAdmin.from('crons_corridas').upsert(
      {
        clave: 'ciclo-promociones',
        ultima_corrida: cuando,
        ultimo_ok: true,
        ultimo_detalle: 'según los datos que dejó el ciclo en el CRM',
      },
      { onConflict: 'clave' },
    )
  } catch (e: any) {
    console.error('[vigilar-crons] No se pudo sincronizar el latido del ciclo:', e?.message ?? e)
  }
}

/** Clave con la que se recuerda que el CRM ya venía fallando. */
const CLAVE_FALLA_ML = '_falla:salud-ml'

/** Desde cuándo viene fallando, o null si es la primera vez. */
export async function fallaMLDesde(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('crons_corridas')
    .select('ultima_corrida')
    .eq('clave', CLAVE_FALLA_ML)
    .maybeSingle()
  return data?.ultima_corrida ?? null
}

export async function anotarFallaML(detalle: string, ahora = new Date()): Promise<void> {
  await supabaseAdmin.from('crons_corridas').upsert(
    { clave: CLAVE_FALLA_ML, ultima_corrida: ahora.toISOString(), ultimo_ok: false, ultimo_detalle: detalle.slice(0, 300) },
    { onConflict: 'clave' },
  )
}

export async function olvidarFallaML(): Promise<void> {
  await supabaseAdmin.from('crons_corridas').delete().eq('clave', CLAVE_FALLA_ML)
}

/** Marca genérica de "ya avisé hoy de esto", para lo que no es un cron. */
export async function yaSeAviso(clave: string, ahora = new Date()): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('crons_corridas')
    .select('ultima_corrida')
    .eq('clave', PREFIJO_AVISO + clave)
    .maybeSingle()
  return !!data && data.ultima_corrida.slice(0, 10) === ahora.toISOString().slice(0, 10)
}

export async function marcarAviso(clave: string, detalle: string, ahora = new Date()): Promise<void> {
  await supabaseAdmin.from('crons_corridas').upsert(
    {
      clave: PREFIJO_AVISO + clave,
      ultima_corrida: ahora.toISOString(),
      ultimo_ok: true,
      ultimo_detalle: detalle.slice(0, 300),
    },
    { onConflict: 'clave' },
  )
}

export function htmlDeSaludML(salud: SaludML, desde?: string | null): string {
  const items = salud.problemas.map(p => `<li style="margin-bottom:6px">${p}</li>`).join('')

  /**
   * Dos mensajes distintos porque son dos problemas distintos.
   *
   * "El CRM dice que la integración está rota" es real y no se arregla solo.
   * "No pude hablar con el CRM" puede ser un arranque en frío. Mandar el texto
   * alarmante para el segundo caso es cómo un aviso se vuelve ruido.
   */
  const roto = salud.alcanzado
  const titulo = roto
    ? 'La conexión con Mercado Libre está rota'
    : 'No se pudo consultar la conexión con Mercado Libre'
  const bajada = roto
    ? 'Esto no se arregla solo. Mientras siga así falla TODO lo de ML: precios, promociones, stock y ventas.'
    : `El CRM no contestó en varios intentos${desde ? `, y viene así desde ${new Date(desde).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}. ` +
      'Puede ser el CRM caído o un problema de red. No sabemos si la integración con ML está bien o mal: no se pudo preguntar.'

  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px">
  <h2 style="font-size:18px;color:${roto ? '#b91c1c' : '#b45309'};margin:0 0 6px">${titulo}</h2>
  <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 12px">${bajada}</p>
  <ul style="font-size:14px;color:#111;line-height:1.6;margin:0 0 16px;padding-left:20px">${items}</ul>
  <p style="font-size:13px;color:#666;line-height:1.6;margin:0">
    ${roto
      ? `Última renovación con éxito: ${salud.ultima_renovacion
          ? new Date(salud.ultima_renovacion).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
          : 'sin registro'}. Se reconecta desde /admin/integraciones del CRM.`
      : 'Si el CRM vuelve solo, este aviso no se repite.'}
  </p>
</div>`
}
