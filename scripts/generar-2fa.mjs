#!/usr/bin/env node
/**
 * Genera el secreto para el 2FA del admin.
 *
 *   node scripts/generar-2fa.mjs
 *
 * Imprime:
 *   1. El valor para la env var ADMIN_TOTP_SECRET (cargar en Vercel).
 *   2. Una URL otpauth:// y la "clave de configuración" para enrolar el
 *      teléfono (Google Authenticator / Authy / 1Password).
 *
 * El secreto se genera acá, en tu máquina, y NO se guarda en ningún lado:
 * copialo a Vercel y al teléfono, y listo. Nunca lo pegues en el chat.
 */
import { randomBytes } from 'node:crypto'

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf) {
  let bits = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += ALFABETO[parseInt(bits.slice(i, i + 5), 2)]
  }
  return out
}

// 20 bytes = 160 bits, lo estándar para TOTP-SHA1.
const secreto = base32Encode(randomBytes(20))

const emisor = 'Flow Things'
const cuenta = 'admin@flowthings.com.ar'
const otpauth =
  `otpauth://totp/${encodeURIComponent(emisor)}:${encodeURIComponent(cuenta)}` +
  `?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=30`

console.log('\n════════════════════════════════════════════════════════════')
console.log(' 2FA del admin — Flow Things')
console.log('════════════════════════════════════════════════════════════\n')
console.log('1) Cargá esta env var en Vercel (Settings → Environment Variables):\n')
console.log(`   ADMIN_TOTP_SECRET=${secreto}\n`)
console.log('2) Enrolá tu teléfono. En Google Authenticator / Authy:')
console.log('   "Ingresar clave de configuración" y pegá:\n')
console.log(`   Clave: ${secreto}`)
console.log(`   Tipo:  Basada en tiempo\n`)
console.log('   O escaneá esta URL como QR (con qrencode, o pegándola):\n')
console.log(`   ${otpauth}\n`)
console.log('3) Redeploy en Vercel. Desde el próximo login te va a pedir el código.\n')
console.log('⚠️  No pegues el secreto en ningún chat ni lo commitees. Si se filtra,')
console.log('   volvé a correr este script y actualizá la env var.\n')
