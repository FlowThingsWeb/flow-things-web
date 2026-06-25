import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Callback de OAuth (Google, Apple, etc.)
 * Supabase redirige aquí con un `code` que se intercambia por una sesión.
 *
 * URL a configurar en Supabase Dashboard → Authentication → URL Configuration:
 *   Site URL: https://tu-dominio.com
 *   Redirect URLs: https://tu-dominio.com/auth/callback
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
      // Crear perfil si no existe (primer login con OAuth)
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

      const faltanDatos = !perfil?.telefono || !perfil?.dni
      if (faltanDatos) {
        return NextResponse.redirect(`${origin}/cuenta/completar-perfil?next=${next}`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Error → volver al login con mensaje
  return NextResponse.redirect(`${origin}/cuenta/login?error=oauth`)
}
