import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    // Detectar si hay una sesión de usuario normal activa
    const hasUserSession = request.cookies.getAll().some(
      c => c.name.startsWith('sb-') && c.name.includes('-auth-token')
    )

    // Si hay sesión de usuario → bloquear admin completamente
    // Redirigir a admin/login con flag de conflicto para mostrar aviso
    if (hasUserSession && !pathname.startsWith('/admin/login')) {
      return NextResponse.redirect(new URL('/admin/login?conflict=1', request.url))
    }

    // Proteger rutas admin (excepto login) con admin_token
    if (!pathname.startsWith('/admin/login')) {
      const token = request.cookies.get('admin_token')?.value

      if (!token) {
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }

      const secret = new TextEncoder().encode(process.env.ADMIN_SECRET ?? '')

      try {
        await jwtVerify(token, secret)
        return NextResponse.next()
      } catch {
        const response = NextResponse.redirect(new URL('/admin/login', request.url))
        response.cookies.delete('admin_token')
        return response
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
