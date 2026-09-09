/**
 * Separar los clicks de personas de los clicks de máquinas.
 *
 * La difusión de Mafalda registró 5 clicks y cero sesiones: ni en Clarity, ni
 * en GA4 —donde una campaña con UNA sola sesión aparece igual—, ni una orden,
 * ni un uso del cupón. Los 5 vinieron del mismo tipo de user agent, tocaron 5
 * links distintos en menos de dos minutos y ninguno ejecutó JavaScript.
 *
 * Eso no es un lector: es el escáner de seguridad del correo del destinatario.
 * Los gateways corporativos —Defender Safe Links, Proofpoint, Barracuda,
 * Mimecast— abren todos los links de cada mail para chequear malware, y usan
 * user agents de navegador real justamente para no ser detectados.
 *
 * Sin esta separación el contador devuelve un número lindo que no significa
 * nada, y peor: da la sensación de que el mail funcionó y que el problema está
 * en el sitio o en el precio, cuando en realidad no entró nadie.
 *
 * NADA SE BORRA. La clasificación pasa al leer, no al escribir: `/r` sigue
 * guardando todo crudo. Si mañana una de estas reglas resulta mala, se corrige
 * acá y los números viejos se recalculan solos. Si filtráramos al escribir,
 * un falso positivo perdería el click para siempre.
 */

export type ClickCrudo = {
  campana: string
  destino: string
  posicion: string | null
  user_agent: string | null
  created_at: string
}

export type MotivoSospecha = 'sin_user_agent' | 'escaner_conocido' | 'rafaga'

export type ClickClasificado = ClickCrudo & {
  sospechoso: boolean
  motivo: MotivoSospecha | null
}

/**
 * Cuánto puede durar una ráfaga y cuántos links distintos la definen.
 *
 * Una persona que abre varios productos del mail lo hace en pestañas, mira, y
 * vuelve: los clicks quedan separados por al menos algunas decenas de segundos
 * y rara vez cubren TODO el mail. Un escáner recorre la lista entera de un
 * saque porque no está leyendo, está chequeando.
 *
 * Tres destinos distintos en dos minutos es deliberadamente conservador: pide
 * las dos cosas a la vez —volumen y velocidad— para no marcar al lector
 * entusiasta que abre dos productos seguidos.
 */
const VENTANA_RAFAGA_MS = 120_000
const MIN_DESTINOS_RAFAGA = 3

/**
 * Firmas de escáneres y clientes no-navegador.
 *
 * Sirve para los que no se disfrazan. Los que sí se disfrazan —el caso de
 * Mafalda, que se presentó como Chrome en Windows— caen por la regla de
 * ráfaga, que mira comportamiento en vez de identidad.
 */
const FIRMAS_ESCANER = [
  // Gateways de seguridad de correo
  'proofpoint', 'barracuda', 'mimecast', 'symantec', 'forcepoint',
  'trendmicro', 'trend micro', 'messagelabs', 'bitdefender', 'safelinks',
  'microsoft office', 'skypeuripreview', 'slackbot', 'whatsapp',
  // Clientes que no son navegadores
  'curl/', 'wget', 'python-requests', 'go-http-client', 'java/', 'okhttp',
  'headless', 'phantomjs', 'puppeteer', 'playwright',
  // Genéricos
  'bot', 'crawler', 'spider', 'scanner', 'preview', 'monitor', 'probe',
]

function firmaDeEscaner(ua: string): boolean {
  const s = ua.toLowerCase()
  return FIRMAS_ESCANER.some(f => s.includes(f))
}

/**
 * El user agent sin números de versión: "Chrome/150.0.0.0" y "Chrome/151.0.0.0"
 * pasan a ser lo mismo.
 *
 * Hace falta porque los escáneres rotan la versión entre pedido y pedido. Los
 * 5 clicks de Mafalda llegaron repartidos entre Chrome 150 y 151: agrupando por
 * user agent exacto la ráfaga se parte en dos grupos de 3 y 2, y el de 2 queda
 * por debajo del mínimo y pasa como humano. Una persona no cambia de versión de
 * Chrome entre un click y el siguiente.
 *
 * El costo: dos lectores distintos con el mismo navegador y sistema quedan en
 * la misma familia. Con listas chicas es irrelevante; si la lista crece a miles,
 * dos personas podrían disparar juntas la regla de ráfaga y quedar marcadas. Se
 * asume a propósito: un click humano de menos sólo baja el número, mientras que
 * un click de máquina de más hace creer que el mail funcionó cuando no. Lo
 * marcado se audita con ?detalle=1 y nunca se borra.
 */
function familiaUa(ua: string): string {
  return ua.toLowerCase().replace(/\d+(?:\.\d+)*/g, '#')
}

/**
 * Marca cada click como humano o sospechoso.
 *
 * El orden de las reglas importa poco —basta con que una dispare— pero el
 * motivo que queda es el primero que aplicó, de lo más específico a lo más
 * inferido, para que al mirar la lista se entienda por qué cayó cada uno.
 */
export function clasificarClicks(filas: ClickCrudo[]): ClickClasificado[] {
  const salida: ClickClasificado[] = filas.map(f => ({
    ...f,
    sospechoso: false,
    motivo: null,
  }))

  // Reglas por fila.
  for (const c of salida) {
    if (!c.user_agent?.trim()) {
      c.sospechoso = true
      c.motivo = 'sin_user_agent'
    } else if (firmaDeEscaner(c.user_agent)) {
      c.sospechoso = true
      c.motivo = 'escaner_conocido'
    }
  }

  // Regla de ráfaga: agrupa por campaña + familia de user agent, que es lo más
  // parecido a "el mismo visitante" que tenemos. A propósito no guardamos IP
  // (ver supabase_clicks_email.sql), así que el user agent es la única llave.
  const grupos = new Map<string, ClickClasificado[]>()
  for (const c of salida) {
    if (!c.user_agent?.trim()) continue
    const k = `${c.campana} ${familiaUa(c.user_agent)}`
    const g = grupos.get(k)
    if (g) g.push(c)
    else grupos.set(k, [c])
  }

  for (const grupo of grupos.values()) {
    if (grupo.length < MIN_DESTINOS_RAFAGA) continue
    grupo.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

    for (let i = 0; i < grupo.length; i++) {
      const inicio = +new Date(grupo[i].created_at)
      const destinos = new Set<string>()
      let j = i
      while (j < grupo.length && +new Date(grupo[j].created_at) - inicio <= VENTANA_RAFAGA_MS) {
        destinos.add(grupo[j].destino)
        j++
      }
      if (destinos.size >= MIN_DESTINOS_RAFAGA) {
        for (let k = i; k < j; k++) {
          if (!grupo[k].sospechoso) {
            grupo[k].sospechoso = true
            grupo[k].motivo = 'rafaga'
          }
        }
      }
    }
  }

  return salida
}

/** Un resumen por campaña, con lo humano separado de lo que no lo es. */
export type ResumenCampana = {
  campana: string
  clicks: number
  reales: number
  sospechosos: number
  ultimo_real: string | null
}

export function resumirPorCampana(clicks: ClickClasificado[]): ResumenCampana[] {
  const m = new Map<string, ResumenCampana>()
  for (const c of clicks) {
    let r = m.get(c.campana)
    if (!r) {
      r = { campana: c.campana, clicks: 0, reales: 0, sospechosos: 0, ultimo_real: null }
      m.set(c.campana, r)
    }
    r.clicks++
    if (c.sospechoso) {
      r.sospechosos++
    } else {
      r.reales++
      if (!r.ultimo_real || c.created_at > r.ultimo_real) r.ultimo_real = c.created_at
    }
  }
  return [...m.values()].sort((a, b) => b.reales - a.reales || b.clicks - a.clicks)
}
