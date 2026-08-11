import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'
import { enqueueJobs } from '@/lib/jobs'
import { buildDifusionHtml } from '@/lib/email'
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
    const { asunto, cuerpo, filtro, emails, usarPlantilla } = await request.json()

    if (!asunto?.trim() || !cuerpo?.trim()) {
      return NextResponse.json({ error: 'Asunto y cuerpo son obligatorios' }, { status: 400 })
    }

    // Resolver la lista final de emails destino.
    let emailsDestino: string[]

    if (Array.isArray(emails) && emails.length > 0) {
      // Lista explícita elegida en el selector (segmento + a mano).
      emailsDestino = [...new Set(
        emails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean),
      )]
    } else {
      // Compat: filtro por segmento (todos / con_compras / sin_compras).
      let users: User[]
      try {
        users = await listarTodosLosUsuarios()
      } catch (e: any) {
        console.error('[broadcast] Error listando usuarios:', e.message)
        return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
      }

      let destinatarios = users.filter(u => !!u.email && u.email_confirmed_at)
      if (filtro === 'con_compras' || filtro === 'sin_compras') {
        const { data: ordenesData } = await supabaseAdmin
          .from('ordenes')
          .select('user_id')
          .eq('estado', 'approved')
          .not('user_id', 'is', null)
        const conCompras = new Set((ordenesData || []).map((o: { user_id: string }) => o.user_id))
        destinatarios = destinatarios.filter(u =>
          filtro === 'con_compras' ? conCompras.has(u.id) : !conCompras.has(u.id),
        )
      }
      emailsDestino = destinatarios.map(u => u.email as string)
    }

    if (emailsDestino.length === 0) {
      return NextResponse.json({ encolados: 0, mensaje: 'No hay destinatarios.' })
    }

    // Cuerpo final: envuelto en la plantilla de marca si corresponde.
    const cuerpoFinal = usarPlantilla ? buildDifusionHtml(cuerpo, { preheader: asunto }) : cuerpo

    // Encolar un job de email por destinatario. El cron los envía en lotes, así
    // el request responde rápido y no se corta por timeout con muchos usuarios.
    const payloads = emailsDestino.map(to => ({ to, asunto, cuerpo: cuerpoFinal }))

    await enqueueJobs('email', payloads)

    // `enviados` se mantiene como alias por retrocompatibilidad con la UI actual;
    // en realidad los emails quedan encolados y el cron los envía en ~1 min.
    return NextResponse.json({
      encolados: payloads.length,
      enviados: payloads.length,
      total: emailsDestino.length,
    })
  } catch (err: any) {
    console.error('[broadcast] Error:', err.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
