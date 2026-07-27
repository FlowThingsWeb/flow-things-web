import { createHmac } from 'crypto'

/**
 * TOTP (RFC 6238) — segundo factor del admin, compatible con Google
 * Authenticator, Authy, 1Password, etc. Sin dependencias externas.
 *
 * El secreto (base32) se guarda en la env var ADMIN_TOTP_SECRET. Se genera
 * una sola vez con `node scripts/generar-2fa.mjs` y se carga en Vercel.
 */

/** Decodifica una cadena base32 (RFC 4648, sin padding) a Buffer. */
function base32Decode(input: string): Buffer {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const limpio = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = ''
  for (const ch of limpio) {
    const idx = alfabeto.indexOf(ch)
    if (idx === -1) continue // ignora chars inválidos
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

/** Genera el código de 6 dígitos para un contador dado (HOTP). */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  // counter como entero de 64 bits big-endian
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (bin % 1_000_000).toString().padStart(6, '0')
}

/**
 * Verifica un código TOTP contra el secreto. Acepta ±1 ventana de 30s para
 * tolerar el desfase de reloj entre el teléfono y el servidor.
 * Comparación en tiempo constante para no filtrar cuántos dígitos coinciden.
 */
export function verifyTOTP(
  token: string,
  secretBase32: string,
  ventana = 1,
  paso = 30,
): boolean {
  const limpio = (token ?? '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(limpio)) return false
  const secret = base32Decode(secretBase32)
  if (secret.length === 0) return false

  const contadorActual = Math.floor(Date.now() / 1000 / paso)
  let ok = false
  // Recorremos todas las ventanas SIEMPRE (sin cortar) para tiempo constante.
  for (let i = -ventana; i <= ventana; i++) {
    const esperado = hotp(secret, contadorActual + i)
    if (constEq(esperado, limpio)) ok = true
  }
  return ok
}

/** Igualdad en tiempo constante de dos strings de misma longitud esperada. */
function constEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** ¿Está configurado el 2FA? (env presente) */
export function totpConfigurado(): boolean {
  return Boolean(process.env.ADMIN_TOTP_SECRET)
}
