import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { createHash, timingSafeEqual } from 'crypto'
import { getClientIp } from '@/lib/client-ip'
import { verifyTOTP, totpConfigurado } from '@/lib/totp'

// Duración de la sesión admin. Larga a propósito: con 2FA en el login, la
// fricción está en entrar, así que mantenemos la sesión iniciada 30 días
// para no pedir código a cada rato.
const SESION_DIAS = 30
const SESION_SEG = SESION_DIAS * 24 * 60 * 60

/**
 * Compara dos strings en tiempo constante. Hashea ambos a 32 bytes fijos antes
 * de comparar, así timingSafeEqual no recibe buffers de distinta longitud
 * (que lanzaría) y no se filtra la longitud del secreto.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// Rate limiting en memoria — best-effort en serverless (por instancia).
// Previene ataques de fuerza bruta desde la misma IP dentro de la misma instancia.
// Para protección cross-instancia, agregar Upstash Redis en el futuro.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

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
    const { email, password, totp } = await request.json()

    // Validar ADMIN_SECRET dentro del handler (no a nivel de módulo)
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) {
      console.error('[auth] ADMIN_SECRET no está configurada')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    const emailOk = safeEqual(String(email ?? ''), process.env.ADMIN_EMAIL ?? '')
    const passOk = safeEqual(String(password ?? ''), process.env.ADMIN_PASSWORD ?? '')

    if (!(emailOk && passOk)) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    // Segundo factor (TOTP). Solo se exige si ADMIN_TOTP_SECRET está
    // configurada — así activar el 2FA es cargar la env, sin quedar
    // bloqueado antes de enrolar el teléfono.
    if (totpConfigurado()) {
      const codigo = String(totp ?? '').trim()
      if (!codigo) {
        // Password OK pero falta el código: el front pide el 2FA.
        return NextResponse.json(
          { error: 'Ingresá el código de 2 pasos', need2fa: true },
          { status: 401 }
        )
      }
      if (!verifyTOTP(codigo, process.env.ADMIN_TOTP_SECRET!)) {
        return NextResponse.json(
          { error: 'Código de 2 pasos incorrecto', need2fa: true },
          { status: 401 }
        )
      }
    }

    // Login exitoso — limpiar intentos fallidos
    clearAttempts(ip)

    const secret = new TextEncoder().encode(adminSecret)
    const token = await new SignJWT({ email, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESION_DIAS}d`)
      .sign(secret)

    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESION_SEG, // sesión larga: 30 días
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
