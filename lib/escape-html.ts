/**
 * Escapar HTML, solo.
 *
 * Vive aparte de `lib/email.ts` porque ese módulo hace `require('nodemailer')`
 * y no se puede importar fuera de Next: cualquier cosa que lo toque sólo se
 * puede probar levantando la aplicación entera. Armar el cuerpo de un mail no
 * necesita saber mandar mails.
 */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
