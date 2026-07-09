import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'
import { enqueueJobs } from '@/lib/jobs'
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

export async function POST(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  try {
    const { asunto, cuerpo, filtro } = await request.json()

    if (!asunto?.trim() || !cuerpo?.trim()) {
      return NextResponse.json({ error: 'Asunto y cuerpo son obligatorios' }, { status: 400 })
    }

    // Listar usuarios registrados desde Supabase Auth (paginado)
    let users: User[]
    try {
      users = await listarTodosLosUsuarios()
    } catch (e: any) {
      console.error('[broadcast] Error listando usuarios:', e.message)
      return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
    }

    // Filtrar según el filtro seleccionado
    let destinatarios = users.filter(u => !!u.email && u.email_confirmed_at)

    if (filtro === 'con_compras') {
      // Solo usuarios que hicieron al menos una compra aprobada
      const { data: ordenesData } = await supabaseAdmin
        .from('ordenes')
        .select('user_id')
        .eq('estado', 'approved')
        .not('user_id', 'is', null)

      const userIdsConCompras = new Set((ordenesData || []).map((o: { user_id: string }) => o.user_id))
      destinatarios = destinatarios.filter(u => userIdsConCompras.has(u.id))
    } else if (filtro === 'sin_compras') {
      const { data: ordenesData } = await supabaseAdmin
        .from('ordenes')
        .select('user_id')
        .eq('estado', 'approved')
        .not('user_id', 'is', null)

      const userIdsConCompras = new Set((ordenesData || []).map((o: { user_id: string }) => o.user_id))
      destinatarios = destinatarios.filter(u => !userIdsConCompras.has(u.id))
    }

    if (destinatarios.length === 0) {
      return NextResponse.json({ encolados: 0, mensaje: 'No hay destinatarios para ese filtro.' })
    }

    // Encolar un job de email por destinatario. El cron los envía en lotes, así
    // el request responde rápido y no se corta por timeout con muchos usuarios.
    const payloads = destinatarios
      .filter(u => !!u.email)
      .map(u => ({ to: u.email as string, asunto, cuerpo }))

    await enqueueJobs('email', payloads)

    // `enviados` se mantiene como alias por retrocompatibilidad con la UI actual;
    // en realidad los emails quedan encolados y el cron los envía en ~1 min.
    return NextResponse.json({
      encolados: payloads.length,
      enviados: payloads.length,
      total: destinatarios.length,
    })
  } catch (err: any) {
    console.error('[broadcast] Error:', err.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
