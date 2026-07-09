import type { NextRequest } from 'next/server'

/**
 * Obtiene la IP del cliente de forma resistente a spoofing.
 *
 * `x-real-ip` lo setea Vercel y el cliente no lo puede falsificar.
 * `x-forwarded-for` sí es manipulable anteponiendo valores falsos, por eso
 * solo se usa como fallback tomando el ÚLTIMO valor (el del proxy más cercano),
 * no el primero (que controla el cliente).
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    'unknown'
  )
}
