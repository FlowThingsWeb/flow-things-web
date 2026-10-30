import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { armarDifusionCyber, guardarBorradorCyber } from '@/lib/difusion-cyber'

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

export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  try {
    const { id, asunto, productos, descuentoMaximo } = await guardarBorradorCyber()
    return NextResponse.json({
      ok: true,
      id,
      asunto,
      productos,
      descuento_maximo: descuentoMaximo,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo guardar el borrador' },
      { status: 500 },
    )
  }
}

/** Vista previa sin guardar nada, para mirar el HTML antes de pisar el borrador. */
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const armado = await armarDifusionCyber()
  return NextResponse.json(armado)
}
