import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function checkAuth(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return true
  return request.headers.get('x-admin-secret') === secret
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Listar usuarios de Supabase Auth
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Cargar perfiles para enriquecer los datos
    const { data: perfiles } = await supabaseAdmin
      .from('perfiles')
      .select('user_id, nombre, telefono, primer_compra_usada')

    const perfilMap = new Map(
      (perfiles || []).map((p: { user_id: string; nombre: string | null; telefono: string | null; primer_compra_usada: boolean }) => [p.user_id, p])
    )

    const usuarios = users.map(u => {
      const perfil = perfilMap.get(u.id)
      return {
        id: u.id,
        email: u.email,
        nombre: perfil?.nombre || u.user_metadata?.nombre || null,
        telefono: perfil?.telefono || null,
        created_at: u.created_at,
        confirmed: !!u.email_confirmed_at,
        primer_compra_usada: perfil?.primer_compra_usada ?? false,
      }
    })

    return NextResponse.json({ usuarios })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
