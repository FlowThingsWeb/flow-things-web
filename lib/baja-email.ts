import crypto from 'crypto'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Baja de las difusiones: link firmado, lista de exclusión y filtro de envío.
 *
 * El link lleva la dirección a dar de baja, así que tiene que venir firmado. Sin
 * firma, `/baja?e=cualquiera@gmail.com` daría de baja a cualquiera con sólo
 * escribir la dirección: alguien podría sacar de la lista a todos los clientes
 * que se le ocurran, y nadie se enteraría hasta que dejaran de llegar los mails.
 *
 * La firma es un HMAC de la dirección con un secreto del servidor. Se puede
 * verificar sin guardar nada —no hace falta una tabla de tokens emitidos— y no
 * se puede fabricar sin el secreto.
 */

/**
 * El secreto de la firma.
 *
 * Preferentemente uno propio; si no está, cae en el del panel, que ya existe en
 * el entorno. HMAC no filtra la clave, así que reutilizarlo no la expone, pero
 * conviene separarlos: si algún día hay que rotar el del panel, no queremos
 * invalidar de paso todos los links de baja de los mails ya enviados.
 */
function secreto(): string {
  const s = process.env.EMAIL_BAJA_SECRET || process.env.ADMIN_SECRET
  if (!s) throw new Error('Falta EMAIL_BAJA_SECRET o ADMIN_SECRET para firmar la baja')
  return s
}

function normalizar(email: string): string {
  return email.trim().toLowerCase()
}

export function tokenBaja(email: string): string {
  return crypto
    .createHmac('sha256', secreto())
    .update(normalizar(email))
    .digest('base64url')
    .slice(0, 32)
}

/**
 * Compara en tiempo constante.
 *
 * Con `===` el tiempo de respuesta depende de cuántos caracteres coinciden, y
 * eso alcanza para ir adivinando la firma de a un carácter por vez.
 */
export function tokenValido(email: string, token: string | null | undefined): boolean {
  if (!token) return false
  const esperado = Buffer.from(tokenBaja(email))
  const recibido = Buffer.from(token)
  if (esperado.length !== recibido.length) return false
  return crypto.timingSafeEqual(esperado, recibido)
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.flowthings.com.ar'

export function linkBaja(email: string): string {
  const e = encodeURIComponent(normalizar(email))
  return `${BASE}/baja?e=${e}&t=${tokenBaja(email)}`
}

/**
 * Registra la baja. Repetirla no es un error: la dirección es la clave.
 *
 * Falla ruidosamente a propósito. El cliente de Supabase no tira excepción:
 * devuelve `{ error }` y sigue. Sin este chequeo, una baja que no se guardó
 * —la tabla todavía no creada, por ejemplo— igual le mostraba a la persona
 * "listo, te sacamos de la lista", y al mail siguiente volvía a recibir. De
 * todas las cosas que pueden fallar en silencio, ésta es la que no puede.
 */
export async function darDeBaja(email: string, motivo: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('bajas_email')
    .upsert({ email: normalizar(email), motivo }, { onConflict: 'email', ignoreDuplicates: true })
  if (error) throw new Error(`No se pudo registrar la baja: ${error.message}`)
}

/**
 * Las direcciones de la lista que NO están dadas de baja.
 *
 * Se consulta una sola vez por difusión en vez de una por destinatario. La
 * consulta se parte en lotes porque `in()` arma la lista en la URL y con miles
 * de direcciones el request se pasa de largo.
 */
export async function filtrarBajas(emails: string[]): Promise<string[]> {
  if (emails.length === 0) return []
  const normalizados = emails.map(normalizar)
  const dadosDeBaja = new Set<string>()

  const LOTE = 300
  for (let i = 0; i < normalizados.length; i += LOTE) {
    const { data, error } = await supabaseAdmin
      .from('bajas_email')
      .select('email')
      .in('email', normalizados.slice(i, i + LOTE))
    // Ante un error de lectura no se asume que nadie se dio de baja: mandarle a
    // alguien que pidió no recibir más es peor que no mandar la difusión.
    if (error) throw new Error(`No se pudo leer la lista de bajas: ${error.message}`)
    for (const f of data ?? []) dadosDeBaja.add(f.email)
  }

  return normalizados.filter(e => !dadosDeBaja.has(e))
}
