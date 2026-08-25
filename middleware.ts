import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Las categorías se mudaron de /productos?categoria=x a /categoria/x. El
  // redirect se hace acá y no en next.config porque ahí el parámetro viejo
  // viaja con la redirección y la URL nueva termina en
  // /categoria/jugueteria?categoria=jugueteria.
  //
  // La búsqueda dentro de una categoría (?q=) sigue viviendo en /productos:
  // esas URLs van con noindex y no tiene sentido darles ruta propia.
  if (pathname === '/productos' && searchParams.has('categoria') && !searchParams.has('q')) {
    const destino = new URL(`/categoria/${searchParams.get('categoria')}`, request.url)
    // Se conservan orden y página, que sí son del catálogo.
    for (const clave of ['orden', 'page']) {
      const valor = searchParams.get(clave)
      if (valor) destino.searchParams.set(clave, valor)
    }
    return NextResponse.redirect(destino, 301)
  }

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
  matcher: ['/admin/:path*', '/productos'],
}
