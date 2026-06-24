import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

// Rate limiting en memoria — best-effort en serverless (por instancia).
// Previene ataques de fuerza bruta desde la misma IP dentro de la misma instancia.
// Para protección cross-instancia, agregar Upstash Redis en el futuro.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

function getClientIp(request: NextRequest): string {
  // x-real-ip es seteado por Vercel y no puede ser spoofado por el cliente.
  // x-forwarded-for puede ser manipulado anteponiendo valores falsos,
  // por eso solo se usa como fallback tomando el ÚLTIMO valor (el del proxy más cercano).
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    'unknown'
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > MAX_ATTEMPTS) return true

  return false
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip)
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Esperá 15 minutos.' },
      { status: 429 }
    )
  }

  try {
    const { email, password } = await request.json()

    // Validar ADMIN_SECRET dentro del handler (no a nivel de módulo)
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) {
      console.error('[auth] ADMIN_SECRET no está configurada')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    // Login exitoso — limpiar intentos fallidos
    clearAttempts(ip)

    const secret = new TextEncoder().encode(adminSecret)
    const token = await new SignJWT({ email, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)

    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 horas
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_token')
  return response
}
