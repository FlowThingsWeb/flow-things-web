import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { armarDifusionCyber } from '@/lib/difusion-cyber'

/**
 * Arma —o rearma— el borrador del mail de las Ofertas Cyber.
 *
 * Guarda, no manda. El envío sigue siendo el de siempre, desde /admin/mailing,
 * con su selección de destinatarios y su filtro de bajas: un endpoint que
 * mande a toda la base con un POST es un accidente esperando que alguien
 * refresque la página.
 *
 * Se puede correr las veces que haga falta. Pisa el mismo borrador en vez de
 * crear uno nuevo cada vez, así no quedan cinco "Ofertas Cyber" en la lista y
 * nadie manda el equivocado.
 */

const TITULO = 'Ofertas Cyber'

export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { asunto, cuerpo, productos, descuentoMaximo } = await armarDifusionCyber()

  const { data: existente } = await supabaseAdmin
    .from('difusiones')
    .select('id')
    .eq('titulo', TITULO)
    .maybeSingle()

  const fila = {
    titulo: TITULO,
    asunto,
    cuerpo,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = existente
    ? await supabaseAdmin.from('difusiones').update(fila).eq('id', existente.id).select().single()
    : await supabaseAdmin.from('difusiones').insert(fila).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    id: data.id,
    asunto,
    productos,
    descuento_maximo: descuentoMaximo,
  })
}

/** Vista previa sin guardar nada, para mirar el HTML antes de pisar el borrador. */
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const armado = await armarDifusionCyber()
  return NextResponse.json(armado)
}
