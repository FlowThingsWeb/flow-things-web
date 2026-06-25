import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'
import { verifyAdminToken } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  try {
    const { asunto, cuerpo, filtro } = await request.json()

    if (!asunto?.trim() || !cuerpo?.trim()) {
      return NextResponse.json({ error: 'Asunto y cuerpo son obligatorios' }, { status: 400 })
    }

    // Listar usuarios registrados desde Supabase Auth
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })

    if (error) {
      console.error('[broadcast] Error listando usuarios:', error.message)
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
      return NextResponse.json({ enviados: 0, mensaje: 'No hay destinatarios para ese filtro.' })
    }

    // Enviar emails (secuencial para no saturar la API de SendGrid)
    let enviados = 0
    let errores = 0
    for (const u of destinatarios) {
      if (!u.email) continue
      try {
        await sendEmail({ to: u.email, asunto, cuerpo })
        enviados++
      } catch (e: any) {
        console.error(`[broadcast] Error enviando a ${u.email}:`, e.message)
        errores++
      }
    }

    return NextResponse.json({ enviados, errores, total: destinatarios.length })
  } catch (err: any) {
    console.error('[broadcast] Error:', err.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
