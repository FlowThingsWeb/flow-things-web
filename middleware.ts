import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServerClient } from '@supabase/ssr'

// Rutas donde el perfil completo es obligatorio para acceder
const REQUIRE_COMPLETE_PROFILE = ['/cuenta', '/carrito']

// Rutas de la sección /cuenta que NO requieren perfil completo
const CUENTA_BYPASS = ['/cuenta/login', '/cuenta/registro', '/cuenta/completar-perfil']

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

  // ── Perfil completo obligatorio ───────────────────────────────────────────
  const needsProfileCheck =
    REQUIRE_COMPLETE_PROFILE.some(p => pathname.startsWith(p)) &&
    !CUENTA_BYPASS.some(p => pathname.startsWith(p))

  if (needsProfileCheck) {
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

    const { data: { user } } = await supabase.auth.getUser()

    if (user && user.user_metadata?.profile_complete !== true) {
      const dest = new URL('/cuenta/completar-perfil', request.url)
      dest.searchParams.set('next', pathname)
      return NextResponse.redirect(dest)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/cuenta/:path*',
    '/carrito',
  ],
}
