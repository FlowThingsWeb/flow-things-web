import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const PC_COOKIE = 'ft_pc'
const PC_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

/**
 * Callback de OAuth (Google, Apple, etc.)
 * Supabase redirige aquí con un `code` que se intercambia por una sesión.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/cuenta'

  if (code) {
    const cookieStore = await cookies()

    // Colectamos las cookies que Supabase quiere setear para aplicarlas
    // directamente sobre el NextResponse (no via cookieStore, que no se propaga).
    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            // Solo colectamos — las seteamos en el response final
            pendingCookies.push(...cookiesToSet)
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const nombre =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        data.user.email?.split('@')[0] ||
        null

      await admin
        .from('perfiles')
        .upsert({ user_id: data.user.id, nombre }, { onConflict: 'user_id', ignoreDuplicates: true })

      // Verificar si faltan datos obligatorios (teléfono y DNI)
      const { data: perfil } = await admin
        .from('perfiles')
        .select('telefono, dni')
        .eq('user_id', data.user.id)
        .single()

      const perfilCompleto = !!(perfil?.telefono && perfil?.dni)

      const redirectUrl = perfilCompleto
        ? `${origin}${next}`
        : `${origin}/cuenta/completar-perfil?next=${encodeURIComponent(next)}`

      const res = NextResponse.redirect(redirectUrl)

      // Aplicar cookies de sesión de Supabase directamente en el response
      pendingCookies.forEach(({ name, value, options }) => {
        res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
      })

      // Si el perfil ya está completo, marcar ft_pc
      if (perfilCompleto) {
        res.cookies.set(PC_COOKIE, '1', PC_OPTS)
      }

      return res
    }
  }

  return NextResponse.redirect(`${origin}/cuenta/login?error=oauth`)
}
