import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  // Traer todos los usuarios de auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Traer perfiles para cruzar datos
  const { data: perfiles } = await supabaseAdmin
    .from('perfiles')
    .select('user_id, nombre, telefono, dni, primer_compra_usada')

  const perfilesMap = new Map(
    (perfiles ?? []).map(p => [p.user_id, p])
  )

  const usuarios = authData.users.map(u => {
    const perfil = perfilesMap.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '',
      nombre: perfil?.nombre ?? u.user_metadata?.full_name ?? '',
      telefono: perfil?.telefono ?? '',
      dni: perfil?.dni ?? '',
      primer_compra_usada: perfil?.primer_compra_usada ?? false,
      confirmed: !!u.email_confirmed_at,
      created_at: u.created_at,
    }
  })

  // Más recientes primero
  usuarios.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ usuarios })
}
