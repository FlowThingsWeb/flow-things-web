/**
 * Decodifica un cert/clave PEM desde una variable de entorno.
 *
 * Soporta dos formatos para evitar el problema de Vercel rompiendo los saltos
 * de línea al pegar valores multilínea:
 *   1. base64 (recomendado): el PEM completo codificado en base64, sin saltos.
 *   2. PEM con `\n` literales o saltos reales (retrocompatibilidad).
 *
 * Si el valor contiene "-----BEGIN" se trata como PEM; si no, como base64.
 */
export function decodeAfipPem(raw: string | undefined): string {
  const v = (raw || '').trim()
  if (!v) return ''
  if (v.includes('-----BEGIN')) {
    return v.replace(/\\n/g, '\n')
  }
  return Buffer.from(v, 'base64').toString('utf8')
}
