import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServerClient } from '@supabase/ssr'

// Rutas que NO requieren perfil completo (se pueden visitar sin datos)
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
  let response = NextResponse.next()

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
    return response
  }

  // ── Perfil completo obligatorio para usuarios logueados ───────────────────
  // Saltear rutas de bypass (auth, api, archivos estáticos, etc.)
  const isBypass = BYPASS_PREFIXES.some(p => pathname.startsWith(p))
  if (isBypass) return response

  // Leer sesión desde cookie (sin network call — lee el JWT local)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  // getSession() lee el JWT de la cookie sin verificar contra el servidor —
  // es rápido y suficiente para este chequeo de UI.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  if (user && user.user_metadata?.profile_complete !== true) {
    const dest = new URL('/cuenta/completar-perfil', request.url)
    dest.searchParams.set('next', pathname)
    return NextResponse.redirect(dest)
  }

  return response
}

export const config = {
  // Aplica a todas las rutas excepto archivos estáticos
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
