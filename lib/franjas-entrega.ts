/**
 * Cuándo puede recibir el comprador, para los envíos por cercanía.
 *
 * Sólo aplica a los que se despachan en el día por km (CABA y alrededores):
 * son los únicos donde la hora de entrega se coordina, porque los maneja el
 * local. Los del correo no tienen franja que prometer.
 *
 * Las reglas, tal como las definió el negocio:
 *
 *   · La franja es siempre de 10 a 18.
 *   · Comprando antes de las 16, se puede entregar ese mismo día: la primera
 *     franja es lo que queda de hoy.
 *   · Comprando de 16 en adelante, la primera franja es el día hábil
 *     siguiente a partir de las 10.
 *   · La última franja es 48 horas hábiles después de la compra, con la hora
 *     de la compra como corte.
 *
 * Las 16 y las 18 son dos cosas distintas y por eso son dos constantes: a las
 * 16 cierra el despacho —después de esa hora la compra ya no sale hoy— y a las
 * 18 cierra la recepción, porque un paquete que sale 16:00 puede estar
 * llegando a las 18:00. Antes eran el mismo número y el margen no existía.
 *   · Sábados y domingos no cuentan: ni para entregar ni para contar las 48
 *     horas.
 *
 * Los feriados se listan abajo, a mano: no hay forma de calcularlos —los
 * trasladables y los puentes turísticos salen por decreto— y pedirlos a una API
 * en el checkout sería colgar una venta de que un tercero conteste.
 */

/**
 * Feriados nacionales, en hora de Buenos Aires.
 *
 * Un feriado no es día hábil: no se entrega y no cuenta para las 48 horas.
 * Hay que extenderla cada año; el 31 de diciembre del último año cargado el
 * cálculo empieza a tratar feriados como días comunes, que es el modo de fallar
 * menos grave (ofrece una franja que después hay que reprogramar, en vez de
 * esconder dos días de entregas).
 */
export const FERIADOS: string[] = [
  "2026-10-12", // Día del Respeto a la Diversidad Cultural
];

const ES_FERIADO = new Set(FERIADOS);

export const HORA_DESDE = 10;
/** Hasta qué hora el comprador puede recibir. */
export const HORA_HASTA = 18;
/** Después de esta hora, la compra ya no sale el mismo día. */
export const HORA_CORTE_DESPACHO = 16;
/** Días hábiles que se pueden ofrecer hacia adelante. 48 horas hábiles = 2 días. */
const DIAS_HABILES = 2;

export type FranjaEntrega = {
  /** Día en formato YYYY-MM-DD (hora de Buenos Aires). */
  dia: string;
  /** Hora de inicio, 10 salvo en el día de la compra. */
  desde: number;
  /** Hora de fin, 16 salvo en el último día, donde corta a las 48 horas. */
  hasta: number;
  /** Lo que ve el comprador: "Hoy (jueves 9/10) de 15 a 16 hs". */
  etiqueta: string;
};

const TZ = "America/Argentina/Buenos_Aires";

/** Partes de una fecha en hora de Buenos Aires, sin importar dónde corra esto. */
function enBA(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return {
    dia: `${get("year")}-${get("month")}-${get("day")}`,
    hora: Number(get("hour")),
    minuto: Number(get("minute")),
  };
}

/** Día de la semana (0 domingo … 6 sábado) de un YYYY-MM-DD. */
function diaSemana(dia: string): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}

const esHabil = (dia: string) => {
  const d = diaSemana(dia);
  return d !== 0 && d !== 6 && !ES_FERIADO.has(dia);
};

function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** El próximo día hábil, sin contar el que se pasa. */
function siguienteHabil(dia: string): string {
  let d = sumarDias(dia, 1);
  while (!esHabil(d)) d = sumarDias(d, 1);
  return d;
}

/** Suma días hábiles: el martes + 2 es el jueves. */
function sumarHabiles(dia: string, n: number): string {
  let d = dia;
  for (let i = 0; i < n; i++) d = siguienteHabil(d);
  return d;
}

const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function etiquetaDe(dia: string, desde: number, hasta: number, hoy: string): string {
  const [, mes, nro] = dia.split("-");
  const nombre = NOMBRE_DIA[diaSemana(dia)];
  const cuando =
    dia === hoy
      ? `Hoy (${nombre} ${Number(nro)}/${Number(mes)})`
      : `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${Number(nro)}/${Number(mes)}`;
  return `${cuando} de ${desde} a ${hasta} hs`;
}

/**
 * Las franjas que se le pueden ofrecer a quien compra en este momento.
 *
 * `ahora` se pasa por parámetro para poder probarlo y para que el servidor
 * calcule lo mismo que el navegador: el cliente propone y el servidor valida
 * con su propio reloj.
 */
export function franjasEntrega(ahora: Date = new Date()): FranjaEntrega[] {
  const { dia: hoy, hora, minuto } = enBA(ahora);

  // Primer día ofrecible y desde qué hora.
  let primerDia: string;
  let primeraHora: number;
  if (esHabil(hoy) && hora < HORA_CORTE_DESPACHO) {
    primerDia = hoy;
    // Lo que queda de hoy. Antes de las 10 la franja arranca a las 10; si ya
    // empezó, arranca en la hora en curso (los minutos se redondean hacia
    // arriba para no prometer una franja que ya está por cerrar).
    primeraHora = Math.max(HORA_DESDE, minuto > 0 ? hora + 1 : hora);
  } else {
    primerDia = siguienteHabil(hoy);
    primeraHora = HORA_DESDE;
  }

  /**
   * El corte de las 48 horas hábiles se cuenta desde la COMPRA, no desde la
   * primera franja: comprando el martes 17:00 el corte es el jueves —no el
   * viernes—, con la hora llevada al tope de la franja.
   */
  const diaBase = esHabil(hoy) ? hoy : siguienteHabil(hoy);
  const ultimoDia = sumarHabiles(diaBase, DIAS_HABILES);
  const horaCorte = esHabil(hoy)
    ? Math.min(Math.max(hora, HORA_DESDE), HORA_HASTA)
    : HORA_HASTA;

  const franjas: FranjaEntrega[] = [];
  let dia = primerDia;
  while (dia <= ultimoDia) {
    if (esHabil(dia)) {
      const desde = dia === primerDia ? primeraHora : HORA_DESDE;
      const hasta = dia === ultimoDia ? horaCorte : HORA_HASTA;
      // Una franja de una hora es lo mínimo que tiene sentido ofrecer.
      if (hasta - desde >= 1) {
        franjas.push({ dia, desde, hasta, etiqueta: etiquetaDe(dia, desde, hasta, hoy) });
      }
    }
    dia = sumarDias(dia, 1);
  }
  return franjas;
}

/** Las etiquetas válidas en este momento, para validar lo que manda el browser. */
export function etiquetasValidas(ahora: Date = new Date()): Set<string> {
  return new Set(franjasEntrega(ahora).map((f) => f.etiqueta));
}
