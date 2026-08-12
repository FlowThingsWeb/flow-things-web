import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'
import type { User } from '@supabase/supabase-js'

/** Lista TODOS los usuarios de Supabase Auth paginando (evita el cap de 1000). */
async function listarTodosLosUsuarios(): Promise<User[]> {
  const perPage = 1000
  const todos: User[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    todos.push(...data.users)
    if (data.users.length < perPage) break
  }
  return todos
}

// GET — destinatarios posibles con datos para el selector (email, nombre, si compró)
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  let users: User[]
  try {
    users = await listarTodosLosUsuarios()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Usuarios con al menos una compra aprobada
  const { data: ordenes } = await supabaseAdmin
    .from('ordenes')
    .select('user_id')
    .eq('estado', 'approved')
    .not('user_id', 'is', null)
  const compradores = new Set((ordenes || []).map((o: { user_id: string }) => o.user_id))

  const destinatarios = users
    .filter((u) => !!u.email)
    .map((u) => ({
      id: u.id,
      email: u.email as string,
      nombre:
        (u.user_metadata?.nombre as string) ||
        (u.user_metadata?.full_name as string) ||
        (u.email as string).split('@')[0],
      compro: compradores.has(u.id),
      confirmado: !!u.email_confirmed_at,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return NextResponse.json({ data: destinatarios })
}
