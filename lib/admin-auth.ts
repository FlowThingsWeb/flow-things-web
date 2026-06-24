/**
 * Utilidad de autenticación admin para API routes.
 * Verifica la firma del JWT — no solo que el cookie exista.
 * El middleware solo protege páginas /admin; las API routes
 * deben llamar a verifyAdminToken() individualmente.
 */
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SECRET
  if (!secret) throw new Error('ADMIN_SECRET no está configurada')
  return new TextEncoder().encode(secret)
}

/**
 * Verifica el JWT del cookie admin_token.
 * Retorna null si es válido, o un NextResponse 401 si no lo es.
 *
 * Uso:
 *   const unauth = await verifyAdminToken(request)
 *   if (unauth) return unauth
 */
export async function verifyAdminToken(request: NextRequest): Promise<NextResponse | null> {
  const token = request.cookies.get('admin_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    await jwtVerify(token, getSecret())
    return null
  } catch {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }
}
