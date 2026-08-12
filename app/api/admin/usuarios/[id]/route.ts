import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  const { id } = await params

  // Datos del usuario en auth
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id)
  if (authError || !authUser.user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Perfil
  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('nombre, apellido, telefono, dni, fecha_nacimiento, primer_compra_usada')
    .eq('user_id', id)
    .single()

  // Órdenes
  const { data: ordenes } = await supabaseAdmin
    .from('ordenes')
    .select('id, total, estado, created_at, items')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    usuario: {
      id: authUser.user.id,
      email: authUser.user.email ?? '',
      confirmed: !!authUser.user.email_confirmed_at,
      created_at: authUser.user.created_at,
      last_sign_in: authUser.user.last_sign_in_at ?? null,
      provider: authUser.user.app_metadata?.provider ?? 'email',
    },
    perfil: perfil ?? null,
    ordenes: ordenes ?? [],
  })
}

// DELETE — elimina la cuenta del usuario (auth + perfil). Las órdenes se
// conservan como historial (quedan con el user_id, sin cuenta asociada).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  const { id } = await params

  // Perfil (best-effort; puede no existir).
  await supabaseAdmin.from('perfiles').delete().eq('user_id', id)

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
