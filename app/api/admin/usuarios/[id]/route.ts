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

  const email = authUser.user.email ?? ''

  // Favoritos (con datos del producto)
  const { data: favoritosRaw } = await supabaseAdmin
    .from('favoritos')
    .select('created_at, productos(id, nombre, slug, activo)')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const favoritos = (favoritosRaw ?? []).map((f: any) => ({
    created_at: f.created_at,
    producto: Array.isArray(f.productos) ? f.productos[0] : f.productos,
  })).filter((f) => f.producto)

  // Mails enviados a este usuario (log de emails_enviados)
  const { data: mails } = email
    ? await supabaseAdmin
        .from('emails_enviados')
        .select('asunto, created_at')
        .ilike('destinatario', email)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] }

  return NextResponse.json({
    usuario: {
      id: authUser.user.id,
      email,
      confirmed: !!authUser.user.email_confirmed_at,
      email_confirmed_at: authUser.user.email_confirmed_at ?? null,
      created_at: authUser.user.created_at,
      last_sign_in: authUser.user.last_sign_in_at ?? null,
      provider: authUser.user.app_metadata?.provider ?? 'email',
    },
    perfil: perfil ?? null,
    ordenes: ordenes ?? [],
    favoritos,
    mails: mails ?? [],
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
