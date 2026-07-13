import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * GET /api/resenas?producto_id=xxx
 * Devuelve las reseñas aprobadas de un producto + el resumen (promedio, cantidad).
 */
export async function GET(request: NextRequest) {
  const productoId = new URL(request.url).searchParams.get('producto_id')
  if (!productoId) {
    return NextResponse.json({ error: 'producto_id requerido' }, { status: 400 })
  }

  const { data: resenas } = await supabaseAdmin
    .from('resenas')
    .select('id, nombre, rating, comentario, created_at')
    .eq('producto_id', productoId)
    .eq('aprobada', true)
    .order('created_at', { ascending: false })
    .limit(50)

  const lista = resenas || []
  const cantidad = lista.length
  const promedio = cantidad > 0
    ? Math.round((lista.reduce((a, r) => a + r.rating, 0) / cantidad) * 10) / 10
    : 0

  return NextResponse.json({ resenas: lista, promedio, cantidad })
}

/**
 * POST /api/resenas
 * Crea/actualiza la reseña del usuario para un producto. Requiere estar logueado
 * (Authorization: Bearer <token>) y haber comprado el producto (orden approved).
 */
export async function POST(request: NextRequest) {
  // Autenticación
  let userId: string | null = null
  let userEmail: string | null = null
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    if (user) { userId = user.id; userEmail = user.email ?? null }
  }
  if (!userId) {
    return NextResponse.json({ error: 'Tenés que iniciar sesión para dejar una reseña.' }, { status: 401 })
  }

  const { producto_id, rating, comentario } = await request.json()

  if (!producto_id || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Datos inválidos (rating 1 a 5).' }, { status: 400 })
  }

  // Verificar que el usuario compró el producto (orden approved que lo incluya)
  const { data: ordenes } = await supabaseAdmin
    .from('ordenes')
    .select('items')
    .eq('user_id', userId)
    .eq('estado', 'approved')

  const compro = (ordenes || []).some((o) =>
    Array.isArray(o.items) && o.items.some((it: any) => it.id === producto_id)
  )
  if (!compro) {
    return NextResponse.json(
      { error: 'Solo podés reseñar productos que compraste.' },
      { status: 403 }
    )
  }

  // Nombre a mostrar: perfil, o parte local del email
  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('nombre')
    .eq('user_id', userId)
    .single()
  const nombre = perfil?.nombre || userEmail?.split('@')[0] || 'Cliente'

  const { error } = await supabaseAdmin
    .from('resenas')
    .upsert(
      {
        producto_id,
        user_id: userId,
        nombre,
        rating,
        comentario: typeof comentario === 'string' ? comentario.slice(0, 1000).trim() : null,
        aprobada: true,
      },
      { onConflict: 'producto_id,user_id' }
    )

  if (error) {
    console.error('[resenas] error al guardar:', error.message)
    return NextResponse.json({ error: 'No se pudo guardar la reseña.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
