import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// Rutas que no requieren perfil completo
const BYPASS_PREFIXES = [
  '/cuenta/completar-perfil',
  '/cuenta/login',
  '/cuenta/registro',
  '/auth/',
  '/api/',
  '/_next/',
  '/favicon',
  '/admin',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin protection ──────────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    const secret = new TextEncoder().encode(process.env.ADMIN_SECRET ?? '')
    try {
      await jwtVerify(token, secret)
    } catch {
      const res = NextResponse.redirect(new URL('/admin/login', request.url))
      res.cookies.delete('admin_token')
      return res
    }
    return NextResponse.next()
  }

  // ── Perfil completo obligatorio ───────────────────────────────────────────
  const isBypass = BYPASS_PREFIXES.some(p => pathname.startsWith(p))
  if (isBypass) return NextResponse.next()

  // Detectar si el usuario está logueado: Supabase guarda cookies con nombre
  // "sb-<project-ref>-auth-token" (puede estar chunked: .0, .1, …)
  const isLoggedIn = request.cookies.getAll().some(
    c => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )

  // Si está logueado pero no tiene la cookie ft_pc=1, redirigir a completar perfil
  if (isLoggedIn && request.cookies.get('ft_pc')?.value !== '1') {
    const dest = new URL('/cuenta/completar-perfil', request.url)
    dest.searchParams.set('next', pathname)
    return NextResponse.redirect(dest)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
