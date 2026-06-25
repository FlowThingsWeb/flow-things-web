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

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
              )
            } catch {
              // En Server Components no se puede mutar cookies — ignorar
            }
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

      if (!perfilCompleto) {
        // Redirigir a completar perfil (sin cookie ft_pc — el middleware bloqueará todo lo demás)
        return NextResponse.redirect(
          `${origin}/cuenta/completar-perfil?next=${encodeURIComponent(next)}`
        )
      }

      // Perfil completo: setear cookie ft_pc en la respuesta de redirect
      const res = NextResponse.redirect(`${origin}${next}`)
      res.cookies.set(PC_COOKIE, '1', PC_OPTS)
      return res
    }
  }

  return NextResponse.redirect(`${origin}/cuenta/login?error=oauth`)
}
