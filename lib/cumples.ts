import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, renderTemplateEstricto, escapeHtml } from '@/lib/email'
import {
  CUMPLE_CIERRE_PCT_DEFAULT, CUMPLE_PCT_DEFAULT, CUMPLE_VARIANTES,
  DEFAULT_CARRITO_CUERPO, URL_SITIO, bloqueCupon, type VarianteCumple,
} from '@/lib/email-constants'

/**
 * El regalo de cumpleaños: un código propio, para todo el mes.
 *
 * La fecha de nacimiento ya estaba en `perfiles` y el formulario de la cuenta
 * ya promete "te mandamos promociones especiales durante tu mes de
 * cumpleaños". Esto es lo que faltaba para que esa promesa fuera cierta.
 *
 * Es por MES y no por día a propósito: un código que vive un día se pierde si
 * esa tarde la persona estaba ocupada, que es lo que suele pasar el día del
 * cumpleaños. Con el mes entero hay tiempo de mirar, pensarlo y volver.
 */

/**
 * Cuántos días del mes le quedan al regalo para ser usado.
 *
 * Abajo de este número el mail cambia de tono: deja de decir "es tu mes" y
 * pasa a despedirlo. Una semana es el corte porque abajo de eso la frase "lo
 * usás cuando quieras" deja de ser cierta.
 */
export const DIAS_PARA_CIERRE = 7

export function varianteDelDia(anio: number, mes: number, dia: number): VarianteCumple {
  const ultimo = Number(ultimoDiaDelMes(anio, mes).slice(-2))
  return ultimo - dia < DIAS_PARA_CIERRE ? 'cierre' : 'mes'
}

/** Cuánto vale el regalo. Se puede mover desde la configuración del sitio. */
export async function pctDeCumple(variante: VarianteCumple = 'mes'): Promise<number> {
  const clave = variante === 'cierre' ? 'cumple_descuento_cierre_pct' : 'cumple_descuento_pct'
  const porDefecto = variante === 'cierre' ? CUMPLE_CIERRE_PCT_DEFAULT : CUMPLE_PCT_DEFAULT
  const { data } = await supabaseAdmin
    .from('configuracion')
    .select('valor')
    .eq('clave', clave)
    .maybeSingle()
  const n = Number(data?.valor)
  return Number.isFinite(n) && n > 0 && n <= 90 ? n : porDefecto
}

/**
 * Qué día es hoy en Argentina.
 *
 * No se puede usar la hora del servidor: Vercel corre en UTC, que va tres
 * horas adelante. Un cron de la medianoche del 1 de octubre UTC se dispara
 * cuando en Argentina todavía son las 21 del 30 de septiembre, y mandaría los
 * regalos de octubre un día antes de que empiece octubre. Peor: el código
 * vencería "a fin de octubre" para alguien a quien le llegó en septiembre.
 */
export function hoyEnArgentina(): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [anio, mes, dia] = partes.split('-').map(Number)
  return { anio, mes, dia }
}

/** El último día del mes, como 'YYYY-MM-DD'. Es hasta cuándo vale el código. */
export function ultimoDiaDelMes(anio: number, mes: number): string {
  // Día 0 del mes siguiente = último del actual, y resuelve febrero y los
  // bisiestos sin tabla de meses.
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Alfabeto sin caracteres que se confundan al leerlos de un mail: nada de
 * 0/O ni 1/I/L. El código se copia a mano más veces de las que uno cree.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function sufijo(largo = 6): string {
  let s = ''
  for (let i = 0; i < largo; i++) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
  }
  return s
}

export type Cumpleanero = {
  user_id: string
  nombre: string | null
  fecha_nacimiento: string
}

/**
 * Quiénes cumplen este mes y todavía no recibieron su regalo este año.
 *
 * El filtro por año y no por mes es lo que hace que cambiar la fecha de
 * nacimiento no regale dos códigos: quien ya recibió el suyo en marzo no
 * vuelve a entrar aunque después diga que cumple en noviembre.
 */
export async function cumpleanerosPendientes(
  anio: number,
  mes: number,
): Promise<Cumpleanero[]> {
  const { data: perfiles } = await supabaseAdmin
    .from('perfiles')
    .select('user_id, nombre, fecha_nacimiento')
    .not('fecha_nacimiento', 'is', null)

  const delMes = (perfiles ?? []).filter(
    (p) => Number(String(p.fecha_nacimiento).slice(5, 7)) === mes,
  )
  if (delMes.length === 0) return []

  const { data: yaEnviados, error } = await supabaseAdmin
    .from('cumples_enviados')
    .select('user_id')
    .eq('anio', anio)
    .in('user_id', delMes.map((p) => p.user_id))

  /**
   * Si no se puede leer el registro, no se manda nada.
   *
   * Tratar el error como "no le mandamos a nadie todavía" es la peor lectura
   * posible: el cron corre todos los días, así que la tabla caída o sin crear
   * se traduciría en el mismo mail de cumpleaños todas las mañanas del mes. Un
   * regalo que llega treinta veces deja de ser un regalo.
   */
  if (error) {
    throw new Error(`No se pudo leer cumples_enviados: ${error.message}`)
  }

  const atendidos = new Set((yaEnviados ?? []).map((e) => e.user_id))
  return delMes.filter((p) => !atendidos.has(p.user_id)) as Cumpleanero[]
}

/**
 * Crea el código del regalo.
 *
 * Vence por las dos vías que pidió el negocio: `usos_maximos: 1` lo mata en
 * cuanto alguien lo usa, y `fecha_vencimiento` el último día del mes. El
 * validador del checkout ya respeta las dos, y toma el día de vencimiento
 * completo (pone 23:59:59), así que el último día sigue siendo hábil.
 *
 * Reintenta si el código sorteado ya existía: con 31^6 combinaciones no va a
 * pasar, pero el UNIQUE de la tabla está para algo y es mejor volver a tirar
 * que romper el envío de alguien.
 */
export async function crearCodigoCumple(opciones: {
  nombre: string
  pct: number
  anio: number
  mes: number
}): Promise<{ codigo: string; vence: string } | null> {
  const vence = ultimoDiaDelMes(opciones.anio, opciones.mes)

  for (let intento = 0; intento < 5; intento++) {
    const codigo = `CUMPLE${sufijo()}`
    const { error } = await supabaseAdmin.from('codigos_descuento').insert({
      codigo,
      descripcion: `Cumpleaños de ${opciones.nombre} — ${MESES[opciones.mes - 1]} ${opciones.anio}`,
      tipo: 'porcentaje',
      valor: opciones.pct,
      activo: true,
      usos_maximos: 1,
      fecha_vencimiento: vence,
    })
    if (!error) return { codigo, vence }
    // 23505 = unique_violation: salió un código repetido, se tira de nuevo.
    if (error.code !== '23505') {
      console.error('[cumples] no se pudo crear el código:', error.message)
      return null
    }
  }
  return null
}

/** "31 de octubre", para la letra chica del cupón. */
export function fechaLarga(iso: string): string {
  const [, mes, dia] = iso.split('-').map(Number)
  return `${dia} de ${MESES[mes - 1]}`
}

/**
 * Manda el regalo a una persona: crea el código, envía el mail y lo registra.
 *
 * El registro va DESPUÉS del envío a propósito. Si el mail falla, no queda
 * anotado y el cron lo reintenta mañana; al revés, un error de red dejaría a
 * alguien sin su regalo y sin manera de saberlo. El precio de equivocarse
 * para este lado es un mail repetido, que es el error barato.
 */
export async function enviarRegaloCumple(
  persona: Cumpleanero,
  pct: number,
  anio: number,
  mes: number,
  variante: VarianteCumple = 'mes',
): Promise<{ ok: boolean; codigo?: string; error?: string }> {
  /**
   * Sin casilla configurada no se intenta nada.
   *
   * `sendEmail` no rompe cuando faltan GMAIL_USER / GMAIL_APP_PASSWORD: avisa
   * por consola y vuelve como si hubiera enviado. Para el resto de la app es
   * lo correcto —que falte una variable no puede tumbar un checkout—, pero acá
   * es una trampa: el código se crea, la fila se anota como enviada y la
   * persona no recibe nada. Y como el registro es por año, se queda sin su
   * regalo hasta el año que viene.
   *
   * Me pasó probando esto desde un entorno sin las credenciales: dos personas
   * quedaron marcadas como avisadas sin que saliera un solo mail.
   */
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { ok: false, error: 'la casilla de envío no está configurada' }
  }

  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(persona.user_id)
  const email = userRes?.user?.email
  if (!email) return { ok: false, error: 'sin email' }

  const nombre = persona.nombre?.trim() || email.split('@')[0] || 'Hola'

  const creado = await crearCodigoCumple({ nombre, pct, anio, mes })
  if (!creado) return { ok: false, error: 'no se pudo crear el código' }

  const copy = CUMPLE_VARIANTES[variante]
  const cuerpo = renderTemplateEstricto(DEFAULT_CARRITO_CUERPO, {
    nombre: escapeHtml(nombre),
    emoji: '&#x1F382;',
    titulo: copy.titulo.replace('{{nombre}}', escapeHtml(nombre)),
    bajada: copy.bajada,
    bloque_extra: bloqueCupon({
      codigo: creado.codigo,
      pct,
      encabezado: copy.encabezado,
      subtitulo: 'en toda la tienda',
      vigencia: `Válido hasta el ${fechaLarga(creado.vence)} &#xB7; se usa una sola vez`,
    }),
    // El mail de carrito abandonado lista lo que quedó adentro; acá no hay
    // carrito, así que ese hueco va vacío y el cupón queda como protagonista.
    productos_lista: '',
    cta: `Usar mi ${pct}% de regalo`,
    link: `${URL_SITIO}/productos`,
  }, `cumple (${variante})`)

  try {
    await sendEmail({ to: email, asunto: copy.asunto, cuerpo })
  } catch (e) {
    // El código queda creado y sin usar: se lo lleva el vencimiento de fin de
    // mes. Anotarlo como enviado sería peor, porque nadie lo recibió.
    return { ok: false, error: e instanceof Error ? e.message : 'error al enviar' }
  }

  const { error } = await supabaseAdmin.from('cumples_enviados').insert({
    user_id: persona.user_id,
    anio,
    mes,
    codigo: creado.codigo,
  })
  if (error) console.error('[cumples] mail enviado pero no registrado:', error.message)

  return { ok: true, codigo: creado.codigo }
}

/**
 * Marca los regalos que se terminaron usando.
 *
 * Es lo único que dice si esto sirve para algo: sin el dato, el mes que viene
 * no hay forma de saber si el 15% movió una venta o sólo mandó mails.
 */
export async function actualizarUsos(): Promise<number> {
  const { data: pendientes } = await supabaseAdmin
    .from('cumples_enviados')
    .select('id, codigo')
    .is('usado_at', null)
  if (!pendientes?.length) return 0

  const { data: usados } = await supabaseAdmin
    .from('codigos_descuento')
    .select('codigo, usos_actuales')
    .in('codigo', pendientes.map((p) => p.codigo))
    .gt('usos_actuales', 0)

  const set = new Set((usados ?? []).map((c) => c.codigo))
  const aMarcar = pendientes.filter((p) => set.has(p.codigo))
  if (aMarcar.length === 0) return 0

  const ahora = new Date().toISOString()
  for (const p of aMarcar) {
    await supabaseAdmin.from('cumples_enviados').update({ usado_at: ahora }).eq('id', p.id)
  }
  return aMarcar.length
}
